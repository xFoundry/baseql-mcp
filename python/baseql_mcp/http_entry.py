import os

from baseql_mcp.server import mcp  # noqa: F401


def main() -> None:
    host = os.getenv("MCP_HOST", "0.0.0.0")
    port = int(os.getenv("MCP_PORT", "8080"))
    transport = os.getenv("MCP_TRANSPORT", "http")
    path = os.getenv("MCP_PATH", "/mcp")

    # FastMCP supports stdio, http, sse; HTTP is recommended for hosted use.
    mcp.run(transport=transport, host=host, port=port, path=path)


if __name__ == "__main__":
    main()

