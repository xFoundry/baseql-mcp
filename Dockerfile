# BaseQL MCP (Python) container for Railway / FastMCP
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app/python

# Install base dependencies
COPY python/requirements.txt /app/python/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY python /app/python

# Install optional fastmcp extra for runtime
RUN pip install --no-cache-dir ".[fastmcp]"

# Runtime configuration
ENV MCP_HOST=0.0.0.0 \
    MCP_PORT=8080 \
    MCP_TRANSPORT=http \
    MCP_PATH=/mcp

EXPOSE 8080

CMD ["python", "-m", "baseql_mcp.http_entry"]

