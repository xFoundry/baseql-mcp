import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GraphQLClient, gql } from "graphql-request";
import dotenv from "dotenv";
import fs from "fs";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  fs.readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
);

export interface BaseQLMCPServerOptions {
  endpoint?: string;
  apiKey?: string;
  transport?: 'stdio' | 'http';
  useKeychain?: boolean;
}

export class BaseQLMCPServer {
  private server: Server;
  private graphqlClient: GraphQLClient | null = null;
  private endpoint: string;
  private apiKey: string;
  private transport: 'stdio' | 'http';

  constructor(options?: BaseQLMCPServerOptions) {
    // Get configuration from options or environment variables
    this.endpoint = options?.endpoint || process.env.BASEQL_API_ENDPOINT || "";
    this.apiKey = options?.apiKey || process.env.BASEQL_API_KEY || "";
    this.transport = options?.transport || 'stdio';

    // Validate configuration
    if (!this.endpoint || !this.apiKey) {
      throw new Error('BaseQL endpoint and API key are required');
    }

    this.server = new Server(
      {
        name: "baseql-mcp",
        version: packageJson.version,
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.initializeGraphQLClient();
  }

  private initializeGraphQLClient() {
    if (this.endpoint && this.apiKey) {
      this.graphqlClient = new GraphQLClient(this.endpoint, {
        headers: {
          Authorization: this.apiKey.startsWith('Bearer ') 
            ? this.apiKey 
            : `Bearer ${this.apiKey}`,
        },
      });
    }
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: "baseql://schema",
            name: "BaseQL Schema",
            description: "GraphQL schema information from your BaseQL endpoint",
            mimeType: "application/json",
          },
        ],
      };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      if (uri === "baseql://schema") {
        if (!this.graphqlClient) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            "BaseQL endpoint not configured. Please set BASEQL_API_ENDPOINT and BASEQL_API_KEY environment variables."
          );
        }

        try {
          const introspectionQuery = gql`
            query IntrospectionQuery {
              __schema {
                types {
                  name
                  kind
                  description
                  fields {
                    name
                    type {
                      name
                      kind
                    }
                  }
                }
              }
            }
          `;

          const data = await this.graphqlClient.request(introspectionQuery);
          
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(data, null, 2),
              },
            ],
          };
        } catch (error) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to fetch schema: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }

      throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
    });

    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "query",
            description: "Execute custom GraphQL queries against your BaseQL endpoint. Use this for complex queries, joins across tables, or when other tools don't meet your needs. BaseQL uses Float (not Int) for numbers, _page_size/_page for pagination, and unquoted keys in filters like {email: \"test@example.com\"}.",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "GraphQL query string. Example: 'query { contacts(_page_size: 5, _filter: {type: \"Student\"}) { id firstName email } }'. Use _order_by for sorting: '_order_by: {lastName: \"asc\"}'. Access linked records: 'purchaser { id fullName }'.",
                },
                variables: {
                  type: "object",
                  description: "GraphQL variables as key-value pairs. Example: {\"emailDomain\": \"umd.edu\"}",
                },
              },
              required: ["query"],
            },
          },
          {
            name: "getTableSchema",
            description: "Get detailed schema information for a specific table including field names, types, and relationships. Use this to understand table structure before querying or to identify available fields for filtering/sorting. Essential for building correct GraphQL queries.",
            inputSchema: {
              type: "object",
              properties: {
                tableName: {
                  type: "string",
                  description: "Name of the table to examine (use listTables first to see available tables)",
                },
              },
              required: ["tableName"],
            },
          },
          {
            name: "listTables",
            description: "List all available tables (data sources) in your BaseQL endpoint. Use this first to discover what data is available, then use getTableSchema to understand specific table structures. Returns table names and descriptions.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false
            },
          },
          {
            name: "queryTable",
            description: "Query data from a table with advanced filtering, sorting, and pagination. Use this for most data retrieval needs. More user-friendly than raw GraphQL queries. Supports exact matches only (no partial matching - use searchTable for that).",
            inputSchema: {
              type: "object",
              properties: {
                tableName: {
                  type: "string",
                  description: "Table name to query (use listTables to see options)",
                },
                fields: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  description: "Specific fields to return, e.g., [\"id\", \"firstName\", \"email\"]. Omit to get all fields (slower).",
                },
                filter: {
                  type: "object",
                  description: "Filter conditions as key-value pairs, e.g., {\"type\": \"Student\", \"email\": \"user@umd.edu\"}. Only exact matches supported. For linked records, filter by ID: {\"purchaser\": [\"rec123xyz\"]}.",
                },
                sort: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      field: {
                        type: "string",
                        description: "Field name to sort by",
                      },
                      direction: {
                        type: "string",
                        enum: ["asc", "desc"],
                        description: "Sort direction: \"asc\" or \"desc\" (lowercase required)",
                      },
                    },
                    required: ["field"],
                  },
                  description: "Sort options, e.g., [{\"field\": \"lastName\", \"direction\": \"asc\"}]",
                },
                limit: {
                  type: "number",
                  description: "Maximum records to return (default: 10, max: 100)",
                },
                offset: {
                  type: "number",
                  description: "Records to skip for pagination. Example: offset 20 with limit 10 gets records 21-30.",
                },
              },
              required: ["tableName"],
            },
          },
          {
            name: "searchTable",
            description: "Search for records in a table by filtering specific fields. Use this to find records containing a search term. Note: BaseQL doesn't support full-text search, so this filters specified fields or common text fields (firstName, lastName, email, name). For exact matches, use queryTable with filters instead.",
            inputSchema: {
              type: "object",
              properties: {
                tableName: {
                  type: "string",
                  description: "The name of the table to search",
                },
                searchTerm: {
                  type: "string",
                  description: "The search term to look for in the specified fields",
                },
                fields: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  description: "Specific fields to search in (required). If not provided, searches common fields: firstName, lastName, email, name",
                },
                limit: {
                  type: "number",
                  description: "Maximum number of results to return (default: 10, max: 100)",
                },
              },
              required: ["tableName", "searchTerm"],
            },
          },
          {
            name: "getFieldOptions",
            description: "Discover possible values for select fields (dropdowns) by analyzing existing data. Use this to see what values are actually being used in a field before filtering or to understand data patterns. Returns unique values with counts. Note: Only shows values currently in use - empty options won't appear.",
            inputSchema: {
              type: "object",
              properties: {
                tableName: {
                  type: "string",
                  description: "Table containing the field to analyze",
                },
                fieldName: {
                  type: "string",
                  description: "Field to analyze (works best with select/dropdown fields like 'type', 'status', 'category')",
                },
                sampleSize: {
                  type: "number",
                  description: "Records to sample for analysis (default: 100, max: 100). Larger samples give more complete results.",
                },
              },
              required: ["tableName", "fieldName"],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (!this.graphqlClient) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "BaseQL endpoint not configured. Please set BASEQL_API_ENDPOINT and BASEQL_API_KEY environment variables."
        );
      }

      switch (name) {
        case "query": {
          const { query, variables } = args as { query: string; variables?: Record<string, any> };
          
          try {
            const data = await this.graphqlClient.request(query, variables);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          } catch (error) {
            throw new McpError(
              ErrorCode.InternalError,
              `GraphQL query failed: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          }
        }

        case "getTableSchema": {
          const { tableName } = args as { tableName: string };
          
          try {
            // Validation
            if (!tableName || typeof tableName !== 'string') {
              throw new McpError(ErrorCode.InvalidRequest, "tableName is required and must be a string. Use listTables to see available table names.");
            }
            const query = gql`
              query GetTableSchema {
                __type(name: "${tableName}") {
                  name
                  description
                  fields {
                    name
                    description
                    type {
                      name
                      kind
                      ofType {
                        name
                        kind
                      }
                    }
                  }
                }
              }
            `;
            
            const data = await this.graphqlClient.request(query);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          } catch (error) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to get table schema: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          }
        }

        case "listTables": {
          try {
            const query = gql`
              query ListTables {
                __schema {
                  types {
                    name
                    kind
                    description
                  }
                }
              }
            `;
            
            const data = await this.graphqlClient.request(query) as any;
            
            // Filter for object types that are likely tables (excluding system types)
            const tables = data.__schema.types
              .filter((type: any) => 
                type.kind === "OBJECT" && 
                !type.name.startsWith("__") &&
                !["Query", "Mutation", "Subscription"].includes(type.name)
              )
              .map((type: any) => ({
                name: type.name,
                description: type.description || "No description available",
              }));
            
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(tables, null, 2),
                },
              ],
            };
          } catch (error) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to list tables: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          }
        }

        case "queryTable": {
          const { tableName, fields, filter, sort, limit, offset } = args as {
            tableName: string;
            fields?: string[];
            filter?: Record<string, any>;
            sort?: Array<{ field: string; direction?: "asc" | "desc" }>;
            limit?: number;
            offset?: number;
          };

          try {
            // Validation
            if (!tableName || typeof tableName !== 'string') {
              throw new McpError(ErrorCode.InvalidRequest, "tableName is required and must be a string");
            }

            if (limit !== undefined && (limit <= 0 || limit > 100)) {
              throw new McpError(ErrorCode.InvalidRequest, "limit must be between 1 and 100 (BaseQL maximum)");
            }

            if (offset !== undefined && offset < 0) {
              throw new McpError(ErrorCode.InvalidRequest, "offset must be 0 or positive");
            }

            // Validate sort directions
            if (sort && sort.length > 0) {
              for (const sortItem of sort) {
                if (sortItem.direction && !["asc", "desc"].includes(sortItem.direction)) {
                  throw new McpError(
                    ErrorCode.InvalidRequest, 
                    `Invalid sort direction "${sortItem.direction}". Use "asc" or "desc" (lowercase)`
                  );
                }
              }
            }
            // Build the fields selection
            const fieldsSelection = fields && fields.length > 0 
              ? fields.join("\n    ")
              : "id\n    __typename";

            // Build arguments for BaseQL
            const args: string[] = [];
            
            if (filter && Object.keys(filter).length > 0) {
              // Convert filter object to GraphQL format (unquoted keys)
              const filterStr = JSON.stringify(filter).replace(/"([^"]+)":/g, '$1:');
              args.push(`_filter: ${filterStr}`);
            }

            if (sort && sort.length > 0) {
              // BaseQL uses _order_by format with lowercase direction
              const orderBy = sort.reduce((acc, s) => {
                acc[s.field] = s.direction || "asc";
                return acc;
              }, {} as Record<string, string>);
              // Convert to GraphQL format (unquoted keys)
              const orderByStr = JSON.stringify(orderBy).replace(/"([^"]+)":/g, '$1:');
              args.push(`_order_by: ${orderByStr}`);
            }

            if (limit !== undefined) {
              args.push(`_page_size: ${limit}`);
            }
            
            if (offset !== undefined) {
              // Convert offset to page number
              const pageSize = limit || 100;
              const page = Math.floor(offset / pageSize) + 1;
              args.push(`_page: ${page}`);
            }

            const argsString = args.length > 0 ? `(${args.join(', ')})` : '';

            const query = gql`
              query QueryTable {
                ${tableName}${argsString} {
                  ${fieldsSelection}
                }
              }
            `;

            const data = await this.graphqlClient.request(query);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          } catch (error) {
            if (error instanceof McpError) {
              throw error;
            }
            
            let errorMessage = error instanceof Error ? error.message : "Unknown error";
            
            // Provide specific guidance for common BaseQL errors
            if (errorMessage.includes("Unknown type Int")) {
              errorMessage += ". BaseQL uses Float instead of Int for numbers.";
            } else if (errorMessage.includes("Unknown argument")) {
              errorMessage += ". BaseQL uses _filter, _page_size, _page, _order_by instead of standard GraphQL arguments.";
            } else if (errorMessage.includes("Cannot query field")) {
              errorMessage += ". Field may not exist - use getTableSchema to see available fields.";
            }
            
            throw new McpError(ErrorCode.InternalError, `Failed to query table: ${errorMessage}`);
          }
        }

        case "searchTable": {
          const { tableName, searchTerm, fields, limit = 10 } = args as {
            tableName: string;
            searchTerm: string;
            fields?: string[];
            limit?: number;
          };

          try {
            // Get table schema first to understand available fields
            const schemaQuery = gql`
              query GetTableSchema {
                __type(name: "${tableName}") {
                  fields {
                    name
                    type {
                      name
                      kind
                    }
                  }
                }
              }
            `;
            
            const schemaData = await this.graphqlClient.request(schemaQuery) as any;
            const tableFields = schemaData.__type?.fields || [];
            
            // Determine which fields to search
            let fieldsToSearch: string[] = [];
            
            if (fields && fields.length > 0) {
              // Use specified fields, but validate they exist
              fieldsToSearch = fields.filter(field => 
                tableFields.some((f: any) => f.name === field && f.type.kind === "SCALAR" && f.type.name === "String")
              );
            } else {
              // Use common text fields that exist in the table
              const commonFields = ["firstName", "lastName", "fullName", "email", "name", "title"];
              fieldsToSearch = commonFields.filter(field => 
                tableFields.some((f: any) => f.name === field && f.type.kind === "SCALAR" && f.type.name === "String")
              );
            }

            if (fieldsToSearch.length === 0) {
              throw new McpError(
                ErrorCode.InvalidRequest,
                `No searchable text fields found in table "${tableName}". Please specify valid string fields to search.`
              );
            }

            // Build search query - BaseQL doesn't support OR, so we'll try the first field
            // In a real implementation, you might need multiple queries
            const searchField = fieldsToSearch[0];
            const searchFilter = { [searchField]: searchTerm };

            const args: string[] = [];
            const filterStr = JSON.stringify(searchFilter).replace(/"([^"]+)":/g, '$1:');
            args.push(`_filter: ${filterStr}`);
            
            const limitedSize = Math.min(limit, 100); // BaseQL max is 100
            args.push(`_page_size: ${limitedSize}`);

            const argsString = args.length > 0 ? `(${args.join(', ')})` : '';

            // Get all string fields for the result
            const resultFields = fieldsToSearch.slice(0, 10).join('\n    '); // Limit to avoid overly long queries

            const query = gql`
              query SearchTable {
                ${tableName}${argsString} {
                  id
                  ${resultFields}
                }
              }
            `;

            const data = await this.graphqlClient.request(query);
            
            const results = {
              searchTerm,
              fieldsSearched: fieldsToSearch,
              primarySearchField: searchField,
              limit: limitedSize,
              note: `Searched for "${searchTerm}" in ${fieldsToSearch.join(", ")}. BaseQL limitations: exact matches only, searched primary field "${searchField}".`,
              results: data
            };

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(results, null, 2),
                },
              ],
            };
          } catch (error) {
            if (error instanceof McpError) {
              throw error;
            }
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to search table: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          }
        }

        case "getFieldOptions": {
          const { tableName, fieldName, sampleSize = 100 } = args as {
            tableName: string;
            fieldName: string;
            sampleSize?: number;
          };

          try {
            // Validation
            if (!tableName || typeof tableName !== 'string') {
              throw new McpError(ErrorCode.InvalidRequest, "tableName is required and must be a string");
            }
            
            if (!fieldName || typeof fieldName !== 'string') {
              throw new McpError(ErrorCode.InvalidRequest, "fieldName is required and must be a string");
            }
            
            if (sampleSize && (sampleSize <= 0 || sampleSize > 100)) {
              throw new McpError(ErrorCode.InvalidRequest, "sampleSize must be between 1 and 100 (BaseQL maximum)");
            }
            // BaseQL limits page size to 100
            const limitedSampleSize = Math.min(sampleSize, 100);

            // Query the table for a sample of records
            const query = gql`
              query GetFieldOptions {
                ${tableName}(_page_size: ${limitedSampleSize}) {
                  ${fieldName}
                }
              }
            `;

            const data = await this.graphqlClient.request(query) as any;
            const records = data[tableName];

            if (!records || records.length === 0) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      tableName,
                      fieldName,
                      sampleSize: 0,
                      totalUnique: 0,
                      values: [],
                      note: "No records found in table"
                    }, null, 2),
                  },
                ],
              };
            }

            // Extract and count unique values
            const valueCounts = new Map<string, number>();
            let nullCount = 0;

            for (const record of records) {
              const value = record[fieldName];
              
              if (value === null || value === undefined) {
                nullCount++;
              } else if (Array.isArray(value)) {
                // Handle multi-select fields
                for (const item of value) {
                  if (item) {
                    valueCounts.set(String(item), (valueCounts.get(String(item)) || 0) + 1);
                  }
                }
              } else {
                // Handle single-select fields
                valueCounts.set(String(value), (valueCounts.get(String(value)) || 0) + 1);
              }
            }

            // Sort by count (descending) and create result array
            const sortedValues = Array.from(valueCounts.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([value, count]) => ({ value, count }));

            const result = {
              tableName,
              fieldName,
              sampleSize: records.length,
              totalUnique: sortedValues.length,
              nullCount,
              values: sortedValues,
              isMultiSelect: records.some((r: any) => Array.isArray(r[fieldName])),
              note: "Values discovered from existing data. Some options may not appear if they are not currently used in any records."
            };

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          } catch (error) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to get field options: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          }
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    });
  }

  async start() {
    if (this.transport === 'stdio') {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error("BaseQL MCP server running on stdio");
    } else {
      // HTTP transport would be implemented here
      throw new Error('HTTP transport not yet implemented');
    }
  }
}

// Support direct execution for backward compatibility
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new BaseQLMCPServer();
  server.start().catch(console.error);
}