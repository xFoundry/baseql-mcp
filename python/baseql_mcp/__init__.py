"""
Python implementation of the BaseQL MCP server.

This package exposes tools for interacting with BaseQL endpoints and
can be run with FastMCP over HTTP/SSE for hosted deployments.
"""

from baseql_mcp.server import create_fastmcp_server, register_tools

__all__ = ["create_fastmcp_server", "register_tools"]

