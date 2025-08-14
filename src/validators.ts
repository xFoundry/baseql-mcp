import { z } from 'zod';

// Validation schemas
export const EndpointSchema = z.string().url().refine(
  (url) => url.includes('baseql.com'),
  'Must be a valid BaseQL endpoint (https://api.baseql.com/...)'
);

export const ApiKeySchema = z.string().refine(
  (key) => key.startsWith('Bearer '),
  'API key must include "Bearer " prefix'
);

export const ConfigSchema = z.object({
  endpoint: EndpointSchema,
  apiKey: ApiKeySchema
});

// Validation functions for inquirer
export function validateEndpoint(input: string): boolean | string {
  try {
    EndpointSchema.parse(input);
    return true;
  } catch (error: any) {
    return error.issues?.[0]?.message || 'Invalid endpoint URL';
  }
}

export function validateApiKey(input: string): boolean | string {
  try {
    ApiKeySchema.parse(input);
    return true;
  } catch (error: any) {
    return error.issues?.[0]?.message || 'Invalid API key format';
  }
}