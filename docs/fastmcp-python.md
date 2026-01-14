# BaseQL MCP (Python) with FastMCP & Railway

This adds a Python implementation of the BaseQL MCP server using
`modelcontextprotocol`/`fastmcp` and exposes HTTP/SSE transports for hosted use.

## Setup locally

```
cd python
pip install -r requirements.txt
# To run the server, also install the optional FastMCP extra:
pip install ".[fastmcp]"
export BASEQL_API_ENDPOINT="https://api.baseql.com/airtable/graphql/YOUR_APP_ID"
export BASEQL_API_KEY="Bearer YOUR_API_KEY"
python -m baseql_mcp.http_entry
```

Environment overrides:
- `MCP_HOST` (default `0.0.0.0`)
- `MCP_PORT` (default `8080`)
- `MCP_TRANSPORT` (`http`, `sse`, `stdio`; default `http`)
- `MCP_PATH` (default `/mcp`)

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

## Railway deployment

1) Add environment variables in Railway:
   - `BASEQL_API_ENDPOINT`
   - `BASEQL_API_KEY` (include `Bearer ` prefix)
   - Optional: `MCP_PORT` (default 8080), `MCP_PATH` (default `/mcp`)

2) Deploy using the provided `Dockerfile` and `Procfile` at repo root. Railway
   will build the Python service and expose port 8080.

3) Connect clients to `https://<railway-host>/mcp` (or the path you configured).

## Manual smoke check

With valid env vars set:

```
python -m baseql_mcp.http_entry &
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"list_tools","jsonrpc":"2.0","id":1}'
```

You should see the registered tools in the response. Stop the local server once
verified.

## Available tools

The Python server mirrors the TypeScript toolset:
- `listTables`
- `getTableSchema`
- `queryTable`
- `searchTable`
- `getFieldOptions`
- `query`

