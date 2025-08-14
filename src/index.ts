#!/usr/bin/env node

// Backward compatibility wrapper for the original index.ts
// This allows the server to be run directly with: node dist/index.js
import { BaseQLMCPServer } from './server.js';

// Support direct execution for backward compatibility
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new BaseQLMCPServer();
  server.start().catch(console.error);
}

// Re-export for module usage
export { BaseQLMCPServer } from './server.js';