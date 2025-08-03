# BaseQL MCP Server

A Model Context Protocol (MCP) server that provides access to BaseQL GraphQL endpoints for Airtable and Google Sheets data.

BaseQL is a service that creates GraphQL APIs for your Airtable bases and Google Sheets, allowing you to query your data with the power and flexibility of GraphQL.

## Features

- **Schema Introspection**: Browse and explore your BaseQL schema
- **Table Management**: List all available tables and get detailed schema information
- **Data Querying**: Execute GraphQL queries with full support for:
  - Field selection
  - Filtering
  - Sorting
  - Pagination
- **Full-Text Search**: Search across your data with field-specific or global search
- **Field Options Discovery**: Analyze existing data to discover single/multi-select field options
- **Resources**: Access schema information as MCP resources

## Prerequisites

1. **BaseQL Account**: Sign up at [baseql.com](https://baseql.com)
2. **Airtable Base or Google Sheet**: Have your data source ready
3. **Node.js**: Version 18 or higher

## Getting BaseQL Credentials

1. Connect your Airtable base or Google Sheet to BaseQL
2. In BaseQL dashboard, find your endpoint URL (format: `https://api.baseql.com/airtable/graphql/YOUR_APP_ID`)
3. Generate an API key from the BaseQL dashboard
4. Note: The API key should be used with "Bearer " prefix

## Installation

### 1. Clone and Build

```bash
git clone <repository-url>
cd baseql-mcp
npm install
npm run build
```

### 2. Configure Environment

Set the following environment variables:

- `BASEQL_API_ENDPOINT`: Your BaseQL GraphQL endpoint URL
- `BASEQL_API_KEY`: Your BaseQL API key for authentication

Example:
```bash
export BASEQL_API_ENDPOINT="https://api.baseql.com/airtable/graphql/YOUR_APP_ID"
export BASEQL_API_KEY="Bearer YOUR_API_KEY"
```

Or create a `.env` file:
```env
BASEQL_API_ENDPOINT=https://api.baseql.com/airtable/graphql/YOUR_APP_ID
BASEQL_API_KEY=Bearer YOUR_API_KEY
```

### 3. Install in Claude Code

```bash
# Using the installation script
./install.sh

# Or manually add to Claude Code
claude mcp add-json baseql "$(cat <<EOF
{
  "command": "node",
  "args": ["$(pwd)/dist/index.js"],
  "env": {
    "BASEQL_API_ENDPOINT": "your-endpoint",
    "BASEQL_API_KEY": "your-api-key"
  }
}
EOF
)"

# Verify installation
claude mcp list
```

## Usage in Claude Code

Once installed, you can use natural language to query your data:

- "Using BaseQL, show me all contacts with email domain @umd.edu"
- "Get the schema for the purchases table"
- "List all available tables in my Airtable base"
- "Query the first 10 products sorted by price"

### Available Tools

#### 1. `query` - Execute GraphQL Queries
Execute any GraphQL query against your BaseQL endpoint.

**Example:**
```graphql
query {
  contacts(_page_size: 5) {
    id
    firstName
    lastName
    email
  }
}
```

**With variables:**
```graphql
query GetContact($email: String!) {
  contacts(_filter: {email: $email}) {
    id
    fullName
    type
  }
}
```

#### 2. `listTables` - List Available Tables
Get a list of all tables available in your BaseQL schema.

#### 3. `getTableSchema` - Get Table Schema
Get detailed schema information for a specific table.

```json
{
  "tableName": "users"
}
```

#### 4. `queryTable` - Query Table Data
Query data from a table with advanced options.

```json
{
  "tableName": "contacts",
  "fields": ["id", "firstName", "lastName", "email"],
  "filter": { "email": "user@example.com" },
  "sort": [{ "field": "lastName", "direction": "DESC" }],
  "limit": 10,
  "offset": 0
}
```

Note: BaseQL uses:
- `_filter` with unquoted keys in GraphQL
- `_order_by` with lowercase directions ("asc"/"desc")
- `_page_size` and `_page` for pagination

#### 5. `searchTable` - Full-Text Search
Perform full-text search on a table.

```json
{
  "tableName": "users",
  "searchTerm": "john",
  "fields": ["name", "email"],
  "limit": 20
}
```

#### 6. `getFieldOptions` - Discover Select Field Options
Analyze existing data to discover possible values for single-select or multi-select fields. This is useful because BaseQL doesn't expose Airtable's select field options as GraphQL enums.

```json
{
  "tableName": "contacts",
  "fieldName": "type",
  "sampleSize": 100
}
```

**Note:** BaseQL limits queries to 100 records maximum, so the tool analyzes up to 100 records to discover field values.

**Example Response:**
```json
{
  "tableName": "contacts",
  "fieldName": "type",
  "sampleSize": 100,
  "totalUnique": 5,
  "nullCount": 45,
  "values": [
    { "value": "Student", "count": 35 },
    { "value": "Staff", "count": 9 },
    { "value": "External", "count": 8 },
    { "value": "Leadership", "count": 2 },
    { "value": "Faculty", "count": 1 }
  ],
  "isMultiSelect": false,
  "note": "Values discovered from existing data. Some options may not appear if they are not currently used in any records."
}
```

**Use Cases:**
- Discovering valid options for dropdown fields in forms
- Understanding data distribution in select fields
- Validating data before updates
- Building dynamic UI components based on actual field options

### Available Resources

- `baseql://schema` - Access the complete GraphQL schema information

## MCP Client Configuration

To use this server with an MCP client, add the following to your client configuration:

```json
{
  "mcpServers": {
    "baseql": {
      "command": "node",
      "args": ["/path/to/baseql-mcp/dist/index.js"],
      "env": {
        "BASEQL_API_ENDPOINT": "your-endpoint",
        "BASEQL_API_KEY": "your-api-key"
      }
    }
  }
}
```

## BaseQL-Specific Notes

### GraphQL Syntax
- BaseQL uses **Float** type instead of **Int** for numbers
- Field arguments must have unquoted keys: `{email: "test@example.com"}` not `{"email": "test@example.com"}`
- Sort direction must be lowercase: `"asc"` or `"desc"` (not "ASC"/"DESC")

### Pagination
- Use `_page_size` and `_page` instead of `limit` and `offset`
- Maximum `_page_size` is 100 records
- Example: `contacts(_page_size: 10, _page: 2)`

### Filtering
- Filter syntax: `_filter: {fieldName: "value"}`
- Multiple filters are AND conditions
- No built-in OR support in filters

### Linked Records
- Linked fields return arrays even for single relationships
- Access linked data through field names: `purchaser`, `team`, `product`

## Troubleshooting

### Common Issues

1. **"Unknown type Int" error**
   - BaseQL uses `Float` for all numeric types
   - Update your queries to use Float instead of Int

2. **"Unknown argument" errors**
   - Check that you're using BaseQL's argument names: `_filter`, `_page_size`, `_page`
   - Not the standard GraphQL `where`, `limit`, `skip`

3. **Invalid filter syntax**
   - Ensure filter keys are unquoted in GraphQL
   - Correct: `_filter: {email: "test@example.com"}`
   - Wrong: `_filter: {"email": "test@example.com"}`

4. **Connection issues**
   - Verify your API endpoint includes the full path
   - Check API key includes "Bearer " prefix if needed
   - Test connection with `claude mcp list`

### Debug Mode

To see detailed logs:
```bash
# Check MCP server status
claude mcp get baseql

# View server logs
tail -f ~/.claude/logs/mcp-*.log
```

## Real-World Examples

### Find Recent Purchases
```graphql
query RecentPurchases {
  purchases(
    _filter: {status: "completed"}
    _order_by: {purchaseDate: "desc"}
    _page_size: 10
  ) {
    id
    amount
    purchaseDate
    purchaserName
    productName
  }
}
```

### Search Contacts by Domain
```graphql
query ContactsByDomain {
  contacts(_page_size: 100) {
    id
    email
    fullName
  }
}
```
Then filter results in your application by email domain.

### Get Team Members
```graphql
query TeamMembers($teamId: String!) {
  members(_filter: {team: [$teamId]}) {
    id
    contact {
      fullName
      email
    }
    status
  }
}
```

## Development

```bash
# Build the TypeScript code
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Check TypeScript types
npm run type-check
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT