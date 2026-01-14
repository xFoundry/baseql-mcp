# BaseQL MCP (Python) with FastMCP

This repo provides a Python implementation of the BaseQL MCP tools.
You can mount these tools inside any FastMCP server (recommended for hosted use).

## Use in a FastMCP server (separate repo)

```
# In your FastMCP server repo
pip install "baseql-mcp[fastmcp]"

from fastmcp import FastMCP
from baseql_mcp.server import register_tools

mcp = FastMCP("BaseQL MCP")
register_tools(mcp)

if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=8080, path="/mcp")
```

Environment variables:
- `BASEQL_API_ENDPOINT` (required)
- `BASEQL_API_KEY` (required, include `Bearer ` prefix)

## FastMCP client example (HTTP)

Point a FastMCP client (or any MCP client that supports HTTP/SSE) at the host:

```
fastmcp_client_config = {
  "mcpServers": {
    "baseql": {
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

## Manual smoke check

With valid env vars set:

```
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"list_tools","jsonrpc":"2.0","id":1}'
```

You should see the registered tools in the response.

## Available tools

The Python server mirrors the TypeScript toolset:
- `listTables`
- `getTableSchema`
- `queryTable`
- `searchTable`
- `getFieldOptions`
- `query`

