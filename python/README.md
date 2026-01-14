# BaseQL MCP (Python)

Python implementation of the BaseQL Model Context Protocol server. It mirrors
the TypeScript tools and is intended for hosted use via FastMCP (HTTP/SSE) or
stdio for local testing.

## Environment

Set the BaseQL credentials before running:

```
export BASEQL_API_ENDPOINT="https://api.baseql.com/airtable/graphql/YOUR_APP_ID"
export BASEQL_API_KEY="Bearer YOUR_API_KEY"
```

## Run locally (HTTP)

```
cd python
pip install -r requirements.txt
# optional, needed to run: pip install ".[fastmcp]"  (or pip install fastmcp)
python -m baseql_mcp.http_entry
```

Options via env:
- `MCP_HOST` (default `0.0.0.0`)
- `MCP_PORT` (default `8080`)
- `MCP_TRANSPORT` (`http`, `sse`, or `stdio`; default `http`)
- `MCP_PATH` (default `/mcp`)

