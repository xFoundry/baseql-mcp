#!/usr/bin/env node

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
import { z } from "zod";
import { GraphQLClient, gql } from "graphql-request";
import axios from "axios";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const BASEQL_API_ENDPOINT = process.env.BASEQL_API_ENDPOINT || "";
const BASEQL_API_KEY = process.env.BASEQL_API_KEY || "";

class BaseQLMCPServer {
  private server: Server;
  private graphqlClient: GraphQLClient | null = null;

  constructor() {
    this.server = new Server(
      {
        name: "baseql-mcp",
        version: "1.0.0",
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
    if (BASEQL_API_ENDPOINT && BASEQL_API_KEY) {
      this.graphqlClient = new GraphQLClient(BASEQL_API_ENDPOINT, {
        headers: {
          Authorization: BASEQL_API_KEY.startsWith('Bearer ') 
            ? BASEQL_API_KEY 
            : `Bearer ${BASEQL_API_KEY}`,
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
            description: "Execute a GraphQL query against your BaseQL endpoint",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "The GraphQL query to execute",
                },
                variables: {
                  type: "object",
                  description: "Variables for the GraphQL query (optional)",
                },
              },
              required: ["query"],
            },
          },
          {
            name: "getTableSchema",
            description: "Get the schema for a specific table",
            inputSchema: {
              type: "object",
              properties: {
                tableName: {
                  type: "string",
                  description: "The name of the table to get schema for",
                },
              },
              required: ["tableName"],
            },
          },
          {
            name: "listTables",
            description: "List all available tables in your BaseQL endpoint",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "queryTable",
            description: "Query data from a specific table with filtering, sorting, and pagination",
            inputSchema: {
              type: "object",
              properties: {
                tableName: {
                  type: "string",
                  description: "The name of the table to query",
                },
                fields: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  description: "Fields to return (optional, returns all if not specified)",
                },
                filter: {
                  type: "object",
                  description: "Filter conditions (optional)",
                },
                sort: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      field: {
                        type: "string",
                        description: "Field to sort by",
                      },
                      direction: {
                        type: "string",
                        enum: ["ASC", "DESC"],
                        description: "Sort direction",
                      },
                    },
                    required: ["field"],
                  },
                  description: "Sort options (optional)",
                },
                limit: {
                  type: "number",
                  description: "Maximum number of records to return (optional)",
                },
                offset: {
                  type: "number",
                  description: "Number of records to skip (optional)",
                },
              },
              required: ["tableName"],
            },
          },
          {
            name: "searchTable",
            description: "Perform full-text search on a table",
            inputSchema: {
              type: "object",
              properties: {
                tableName: {
                  type: "string",
                  description: "The name of the table to search",
                },
                searchTerm: {
                  type: "string",
                  description: "The search term",
                },
                fields: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  description: "Fields to search in (optional, searches all text fields if not specified)",
                },
                limit: {
                  type: "number",
                  description: "Maximum number of results to return (optional)",
                },
              },
              required: ["tableName", "searchTerm"],
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
            sort?: Array<{ field: string; direction?: "ASC" | "DESC" }>;
            limit?: number;
            offset?: number;
          };

          try {
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
                acc[s.field] = (s.direction || "ASC").toLowerCase();
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
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to query table: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          }
        }

        case "searchTable": {
          const { tableName, searchTerm, fields, limit } = args as {
            tableName: string;
            searchTerm: string;
            fields?: string[];
            limit?: number;
          };

          try {
            // For BaseQL, we'll search using field filters
            // Since there's no global search, we'll search specific fields
            const searchFilter = fields && fields.length > 0
              ? fields.reduce((acc, field) => ({
                  ...acc,
                  [field]: searchTerm
                }), {})
              : { 
                  // Default search in common text fields
                  firstName: searchTerm,
                  lastName: searchTerm,
                  email: searchTerm,
                  name: searchTerm
                };

            const args: string[] = [];
            // Convert filter to GraphQL format (unquoted keys)
            const filterStr = JSON.stringify(searchFilter).replace(/"([^"]+)":/g, '$1:');
            args.push(`_filter: ${filterStr}`);
            
            if (limit) {
              args.push(`_page_size: ${limit}`);
            }

            const argsString = args.length > 0 ? `(${args.join(', ')})` : '';

            const query = gql`
              query SearchTable {
                ${tableName}${argsString} {
                  id
                  __typename
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
              `Failed to search table: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          }
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("BaseQL MCP server running on stdio");
  }
}

const server = new BaseQLMCPServer();
server.run().catch(console.error);