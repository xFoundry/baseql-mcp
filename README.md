# BaseQL MCP Server

A Model Context Protocol (MCP) server that provides access to BaseQL GraphQL endpoints for Airtable and Google Sheets data.

BaseQL is a service that creates GraphQL APIs for your Airtable bases and Google Sheets, allowing you to query your data with the power and flexibility of GraphQL.

[![npm version](https://badge.fury.io/js/%40baseql%2Fmcp-server.svg)](https://badge.fury.io/js/%40baseql%2Fmcp-server)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

## 🚀 Quick Start

### Easy Installation (Recommended)

The fastest way to get started with BaseQL MCP Server:

```bash
# Interactive setup wizard (recommended)
npx @baseql/mcp-server setup

# Or start server directly with your credentials
npx @baseql/mcp-server serve --endpoint YOUR_ENDPOINT --key "Bearer YOUR_API_KEY"
```

That's it! The setup wizard will:
- ✅ Verify your BaseQL credentials
- ✅ Test your connection
- ✅ Automatically configure Claude Desktop
- ✅ Create local environment files

### Prerequisites

1. **BaseQL Account**: Sign up at [baseql.com](https://baseql.com)
2. **Airtable Base or Google Sheet**: Connect your data source to BaseQL
3. **Node.js**: Version 18 or higher

### Getting BaseQL Credentials

1. Connect your Airtable base or Google Sheet to BaseQL
2. In BaseQL dashboard, find your endpoint URL: `https://api.baseql.com/airtable/graphql/YOUR_APP_ID`
3. Generate an API key from the BaseQL dashboard
4. **Important**: API key must include "Bearer " prefix

## 📦 Installation Options

### Option 1: NPX (No Installation Required)
```bash
# Run setup wizard
npx @baseql/mcp-server setup

# Start server
npx @baseql/mcp-server serve

# Validate configuration
npx @baseql/mcp-server validate
```

### Option 2: Global Installation
```bash
# Install globally
npm install -g @baseql/mcp-server

# Use anywhere
baseql-mcp setup
baseql-mcp serve
baseql-mcp validate
```

### Option 3: Local Development
```bash
# Clone and build from source
git clone https://github.com/baseql/mcp-server.git
cd mcp-server
npm install
npm run build

# Use locally
node dist/cli.js setup
```

## 🛠️ CLI Commands

### `setup` - Interactive Configuration Wizard
```bash
npx @baseql/mcp-server setup
```

The setup wizard will:
- Check your BaseQL account
- Validate your credentials
- Test the connection
- Configure your MCP client (Claude Desktop, VS Code, etc.)
- Save environment files for development

### `serve` - Start the MCP Server
```bash
# Use environment variables or .env file
npx @baseql/mcp-server serve

# Provide credentials directly
npx @baseql/mcp-server serve \
  --endpoint "https://api.baseql.com/airtable/graphql/YOUR_APP_ID" \
  --key "Bearer YOUR_API_KEY"

# Specify transport (default: stdio)
npx @baseql/mcp-server serve --transport stdio
```

### `validate` - Test Configuration
```bash
npx @baseql/mcp-server validate
```

Validates:
- ✅ Configuration file format
- ✅ API endpoint accessibility
- ✅ Authentication credentials
- ✅ MCP client integration
- ✅ Server functionality

## ⚙️ Configuration

### Automatic Configuration (Recommended)

Run the setup wizard to automatically configure your environment:

```bash
npx @baseql/mcp-server setup
```

### Manual Configuration

#### Environment Variables
```bash
export BASEQL_API_ENDPOINT="https://api.baseql.com/airtable/graphql/YOUR_APP_ID"
export BASEQL_API_KEY="Bearer YOUR_API_KEY"
```

#### .env File
Create a `.env` file in your project root:
```env
BASEQL_API_ENDPOINT=https://api.baseql.com/airtable/graphql/YOUR_APP_ID
BASEQL_API_KEY=Bearer YOUR_API_KEY
```

### MCP Client Configuration

#### Claude Desktop
The setup wizard automatically configures Claude Desktop, or you can add manually:

```json
{
  "mcpServers": {
    "baseql": {
      "command": "npx",
      "args": ["-y", "@baseql/mcp-server", "serve"],
      "env": {
        "BASEQL_API_ENDPOINT": "https://api.baseql.com/airtable/graphql/YOUR_APP_ID",
        "BASEQL_API_KEY": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

#### VS Code / Cursor
Add to your `.vscode/mcp.json`:

```json
{
  "servers": {
    "baseql": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@baseql/mcp-server", "serve"],
      "env": {
        "BASEQL_API_ENDPOINT": "https://api.baseql.com/airtable/graphql/YOUR_APP_ID",
        "BASEQL_API_KEY": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

## 📊 Features

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
- **Configuration Validation**: Built-in tools to test your setup
- **Cross-Platform Support**: Works on Windows, macOS, and Linux

## 🎯 Usage in Claude Desktop

Once configured, you can use natural language to query your data. The MCP automatically selects the right tool based on your request:

### Discovery & Exploration
- "Using BaseQL, what tables are available?"
- "Show me the schema for the contacts table"
- "What are the possible values for the 'type' field in contacts?"

### Data Querying
- "Get the first 10 contacts who are Students"
- "Find all purchases over $100 sorted by amount"
- "Show me contacts from University of Maryland (umd.edu domain)"
- "Get team members from the Engineering team"

### Advanced Queries
- "Search for contacts named 'John' in any field"
- "Filter programs by graduation year 2024, show program name and college"
- "Get all events this month with their attendance count"

## 🔧 Available Tools

The BaseQL MCP provides 6 specialized tools that LLMs automatically select based on your needs:

### 1. `listTables` - Discover Available Data
**Use first** to see what data is available in your BaseQL endpoint.

**What it returns:** List of all tables with descriptions
**When to use:** Starting point for any data exploration

### 2. `getTableSchema` - Understand Table Structure  
**Essential** before querying to understand field names, types, and relationships.

**Example Input:**
```json
{"tableName": "contacts"}
```

**When to use:** Before building queries or understanding what fields you can filter/sort by

### 3. `queryTable` - Retrieve Data (Most Common)
**Primary tool** for getting data with filtering, sorting, and pagination.

**Example - Get Students:**
```json
{
  "tableName": "contacts",
  "fields": ["id", "firstName", "email", "type"],
  "filter": {"type": "Student"},
  "limit": 10
}
```

**Example - Sort by Name:**
```json
{
  "tableName": "contacts", 
  "sort": [{"field": "lastName", "direction": "asc"}],
  "limit": 20
}
```

**Key Points:**
- ✅ Exact matches only: `{"email": "user@umd.edu"}`
- ✅ Sort directions: `"asc"` or `"desc"` (lowercase)
- ✅ Linked records: `{"team": ["recXYZ123"]}`
- ✅ Max limit: 100 records

### 4. `searchTable` - Find Records by Text
Search for records containing specific text in fields.

**Example:**
```json
{
  "tableName": "contacts",
  "searchTerm": "engineering",
  "fields": ["firstName", "lastName", "email"],
  "limit": 10
}
```

**Important:** This filters specific fields, not full-text search. Use `queryTable` for exact matches.

### 5. `getFieldOptions` - Discover Dropdown Values
**Perfect** for understanding what values are used in select/dropdown fields.

**Example:**
```json
{
  "tableName": "contacts",
  "fieldName": "type",
  "sampleSize": 50
}
```

**Returns:** `[{"value": "Student", "count": 25}, {"value": "Staff", "count": 8}]`

### 6. `query` - Advanced GraphQL (Expert Use)
Execute custom GraphQL queries for complex needs.

**Example:**
```graphql
query {
  contacts(_page_size: 5, _filter: {type: "Student"}) {
    id
    firstName
    email
    education {
      institution
      graduationYear
    }
  }
}
```

**BaseQL Syntax Notes:**
- Use `Float` not `Int` for numbers
- Use `_page_size` and `_page` for pagination  
- Unquoted keys in filters: `{email: "test@example.com"}`
- Access linked data: `purchaser { id fullName }`

## 💡 Common Patterns & Best Practices

### Typical Workflow
1. **Start with `listTables`** - See what data is available
2. **Use `getTableSchema`** - Understand table structure  
3. **Query with `queryTable`** - Get the data you need
4. **Use `getFieldOptions`** - For dropdown/select fields

### Smart Filtering Examples
```json
// Find university students
{"filter": {"type": "Student", "email": "*umd.edu"}}

// Get recent records (if you have a date field)
{"filter": {"created": "2024-01-01"}, "sort": [{"field": "created", "direction": "desc"}]}

// Filter by linked record ID
{"filter": {"team": ["recABC123"]}}
```

### Performance Tips
- **Specify fields** you need: `"fields": ["id", "name", "email"]`
- **Use reasonable limits**: Default 10, max 100
- **Sort by indexed fields** when possible
- **Filter first, then sort** for better performance

### When to Use Each Tool
- **Discovery**: `listTables` → `getTableSchema`  
- **Simple queries**: `queryTable` (90% of use cases)
- **Text search**: `searchTable` (limited - filters specific fields)
- **Complex joins**: `query` (advanced GraphQL)
- **Dropdown values**: `getFieldOptions`

## 🗄️ Available Resources

- `baseql://schema` - Access the complete GraphQL schema information

## 📝 BaseQL-Specific Notes

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

## 🐛 Troubleshooting

### Diagnosis Tools

```bash
# Validate your entire setup
npx @baseql/mcp-server validate

# Check CLI help
npx @baseql/mcp-server --help

# Check specific command help
npx @baseql/mcp-server setup --help
```

### Common Issues

1. **"Missing required credentials"**
   - Run `npx @baseql/mcp-server setup` to configure
   - Ensure API key has "Bearer " prefix
   - Check endpoint URL format

2. **"Connection failed"**
   - Verify your API endpoint is accessible
   - Check your API key is valid
   - Test with: `npx @baseql/mcp-server validate`

3. **"Unknown type Int" error**
   - BaseQL uses `Float` for all numeric types
   - Update your queries to use Float instead of Int

4. **"Unknown argument" errors**
   - Check that you're using BaseQL's argument names: `_filter`, `_page_size`, `_page`
   - Not the standard GraphQL `where`, `limit`, `skip`

5. **MCP client not finding server**
   - Restart your MCP client (Claude Desktop, VS Code, etc.)
   - Check configuration with: `npx @baseql/mcp-server validate`
   - Verify client configuration format

### Debug Mode

For detailed debugging:
```bash
# Check environment variables
npx @baseql/mcp-server validate

# Test connection manually
curl -X POST https://api.baseql.com/airtable/graphql/YOUR_APP_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"query": "{ __schema { queryType { name } } }"}'
```

## 📚 Real-World Examples

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

## 🔄 Migration from v1.x

If you're upgrading from BaseQL MCP Server v1.x:

### Quick Migration
```bash
# Install new version
npx @baseql/mcp-server setup
```

The setup wizard will automatically:
- Detect your existing configuration
- Update to the new format
- Test your setup

### Manual Migration

1. **Old Configuration** (v1.x):
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

2. **New Configuration** (v2.0+):
   ```json
   {
     "mcpServers": {
       "baseql": {
         "command": "npx",
         "args": ["-y", "@baseql/mcp-server", "serve"],
         "env": {
           "BASEQL_API_ENDPOINT": "your-endpoint",
           "BASEQL_API_KEY": "your-api-key"
         }
       }
     }
   }
   ```

### What's New in v2.0

- ✅ **NPM Package**: No more manual building or cloning
- ✅ **Interactive Setup**: Guided configuration wizard
- ✅ **Built-in Validation**: Test your setup with one command
- ✅ **Cross-platform**: Automatic path detection for all platforms
- ✅ **Better Error Messages**: Clear, actionable error messages
- ✅ **Backward Compatibility**: v1.x configurations still work

## 🛠️ Development

### Build from Source
```bash
# Clone repository
git clone https://github.com/baseql/mcp-server.git
cd mcp-server

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run locally
node dist/cli.js setup
```

### Scripts
```bash
# Build the TypeScript code
npm run build

# Run in development mode
npm run dev

# Type checking
npm run type-check

# Run tests
npm test
```

### Project Structure
```
src/
├── cli.ts              # CLI entry point
├── server.ts           # Main server implementation
├── setup.ts            # Interactive setup wizard
├── validator.ts        # Configuration validation
├── validators.ts       # Schema validation utilities
├── config-manager.ts   # Configuration file management
└── index.ts            # Module exports & backward compatibility
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- **Documentation**: [GitHub Repository](https://github.com/baseql/mcp-server)
- **Issues**: [GitHub Issues](https://github.com/baseql/mcp-server/issues)
- **BaseQL Support**: [support@baseql.com](mailto:support@baseql.com)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for the MCP community**