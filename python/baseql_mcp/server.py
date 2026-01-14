import json
import os
import re
from typing import Any, Dict, List, Optional

import httpx

_GRAPHQL_KEY_RE = re.compile(r'"([A-Za-z0-9_]+)":')
_DEFAULT_SEARCH_FIELDS = [
    "firstName",
    "lastName",
    "fullName",
    "email",
    "name",
    "title",
]


def _get_config() -> tuple[str, str]:
    endpoint = os.getenv("BASEQL_API_ENDPOINT", "").strip()
    api_key = os.getenv("BASEQL_API_KEY", "").strip()

    if not endpoint or not api_key:
        raise RuntimeError(
            "BASEQL_API_ENDPOINT and BASEQL_API_KEY must be set "
            "to use the BaseQL MCP server."
        )

    if not api_key.startswith("Bearer "):
        api_key = f"Bearer {api_key}"

    return endpoint, api_key


async def _graphql_request(query: str, variables: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    endpoint, api_key = _get_config()
    payload: Dict[str, Any] = {"query": query}
    if variables:
        payload["variables"] = variables

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            endpoint,
            json=payload,
            headers={
                "Authorization": api_key,
                "Content-Type": "application/json",
            },
        )
        response.raise_for_status()
        body = response.json()

    if "errors" in body and body["errors"]:
        message = body["errors"][0].get("message", "GraphQL error")
        raise RuntimeError(message)

    return body.get("data", {})


def _to_graphql_object(value: Dict[str, Any]) -> str:
    # Convert JSON object string to GraphQL format by unquoting keys.
    raw = json.dumps(value, ensure_ascii=False)
    return _GRAPHQL_KEY_RE.sub(r"\1:", raw)


def _build_order_by(sort: Optional[List[Dict[str, str]]]) -> Optional[str]:
    if not sort:
        return None

    order_map: Dict[str, str] = {}
    for item in sort:
        field = item.get("field")
        if not field:
            continue
        direction = item.get("direction", "asc").lower()
        if direction not in ("asc", "desc"):
            raise ValueError('Sort direction must be "asc" or "desc"')
        order_map[field] = direction

    if not order_map:
        return None
    return _to_graphql_object(order_map)


async def listTables() -> Dict[str, Any]:
    """List available tables in the BaseQL schema."""
    query = """
    query ListTables {
      __schema {
        types {
          name
          kind
          description
        }
      }
    }
    """
    data = await _graphql_request(query)
    types = data.get("__schema", {}).get("types", [])
    tables = [
        {
            "name": t["name"],
            "description": t.get("description") or "No description available",
        }
        for t in types
        if t.get("kind") == "OBJECT"
        and not t.get("name", "").startswith("__")
        and t.get("name") not in {"Query", "Mutation", "Subscription"}
    ]
    return {"tables": tables}


async def getTableSchema(tableName: str) -> Dict[str, Any]:
    """Return field names and types for a table."""
    if not tableName:
        raise ValueError("tableName is required")

    query = """
    query GetTableSchema($name: String!) {
      __type(name: $name) {
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
    """
    data = await _graphql_request(query, {"name": tableName})
    return data


async def queryTable(
    tableName: str,
    fields: Optional[List[str]] = None,
    filter: Optional[Dict[str, Any]] = None,
    sort: Optional[List[Dict[str, str]]] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
) -> Dict[str, Any]:
    """Query a table with filters, sorting, and pagination."""
    if not tableName:
        raise ValueError("tableName is required")

    args: List[str] = []

    if filter:
        args.append(f"_filter: {_to_graphql_object(filter)}")

    order_by = _build_order_by(sort)
    if order_by:
        args.append(f"_order_by: {order_by}")

    if limit is not None:
        if limit <= 0 or limit > 100:
            raise ValueError("limit must be between 1 and 100")
        args.append(f"_page_size: {limit}")

    if offset is not None:
        if offset < 0:
            raise ValueError("offset must be 0 or positive")
        page_size = limit if limit is not None else 100
        page = (offset // page_size) + 1
        args.append(f"_page: {page}")

    args_str = f"({', '.join(args)})" if args else ""
    selection = "id\n    __typename"
    if fields:
        selection = "\n    ".join(fields)

    query = f"""
    query QueryTable {{
      {tableName}{args_str} {{
        {selection}
      }}
    }}
    """
    data = await _graphql_request(query)
    return data


async def searchTable(
    tableName: str,
    searchTerm: str,
    fields: Optional[List[str]] = None,
    limit: int = 10,
) -> Dict[str, Any]:
    """Search by exact match across specific string fields."""
    if not tableName:
        raise ValueError("tableName is required")
    if not searchTerm:
        raise ValueError("searchTerm is required")

    if not fields:
        raise ValueError(
            "fields is required for searchTable. "
            "Use getTableSchema to discover valid string fields, "
            "then pass those field names explicitly."
        )

    # Discover text fields
    schema_query = """
    query GetTableFields($name: String!) {
      __type(name: $name) {
        fields {
          name
          type { name kind }
        }
      }
    }
    """
    schema = await _graphql_request(schema_query, {"name": tableName})
    field_defs = schema.get("__type", {}).get("fields", [])

    available_text_fields = [
        f["name"]
        for f in field_defs
        if f.get("type", {}).get("kind") == "SCALAR"
        and f.get("type", {}).get("name") == "String"
    ]

    fields_to_search = [f for f in fields if f in available_text_fields]
    if not fields_to_search:
        raise ValueError(
            f"No valid string fields found in '{tableName}' for search. "
            "Use getTableSchema to list available fields."
        )

    primary_field = fields_to_search[0]
    filter_obj = {primary_field: searchTerm}

    args = [
        f"_filter: {_to_graphql_object(filter_obj)}",
        f"_page_size: {min(limit, 100)}",
    ]
    args_str = f"({', '.join(args)})"

    result_fields = ["id"] + fields_to_search[:10]
    selection = "\n    ".join(result_fields)

    query = f"""
    query SearchTable {{
      {tableName}{args_str} {{
        {selection}
      }}
    }}
    """
    data = await _graphql_request(query)
    return {
        "searchTerm": searchTerm,
        "fieldsSearched": fields_to_search,
        "primaryField": primary_field,
        "results": data,
    }


async def getFieldOptions(
    tableName: str,
    fieldName: str,
    sampleSize: int = 100,
) -> Dict[str, Any]:
    """Return observed values for a field (from a sample)."""
    if not tableName:
        raise ValueError("tableName is required")
    if not fieldName:
        raise ValueError("fieldName is required")
    if sampleSize <= 0 or sampleSize > 100:
        raise ValueError("sampleSize must be between 1 and 100")

    query = f"""
    query GetFieldOptions {{
      {tableName}(_page_size: {sampleSize}) {{
        {fieldName}
      }}
    }}
    """
    data = await _graphql_request(query)
    records = data.get(tableName, [])

    counts: Dict[str, int] = {}
    null_count = 0

    for record in records:
        value = record.get(fieldName)
        if value is None:
            null_count += 1
            continue

        if isinstance(value, list):
            for item in value:
                if item is None:
                    null_count += 1
                    continue
                key = str(item)
                counts[key] = counts.get(key, 0) + 1
        else:
            key = str(value)
            counts[key] = counts.get(key, 0) + 1

    values = [
        {"value": v, "count": counts[v]}
        for v in sorted(counts, key=counts.get, reverse=True)
    ]

    return {
        "tableName": tableName,
        "fieldName": fieldName,
        "sampleSize": len(records),
        "nullCount": null_count,
        "values": values,
        "isMultiSelect": any(isinstance(r.get(fieldName), list) for r in records),
        "note": "Values discovered from existing data; unused options will not appear.",
    }


async def query(query: str, variables: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Execute a raw GraphQL query."""
    if not query:
        raise ValueError("query is required")
    data = await _graphql_request(query, variables)
    return data


def register_tools(mcp: Any) -> Any:
    """
    Register BaseQL tools on an existing FastMCP server instance.

    Usage:
        from fastmcp import FastMCP
        from baseql_mcp.server import register_tools

        mcp = FastMCP("BaseQL MCP")
        register_tools(mcp)
    """

    mcp.tool()(listTables)
    mcp.tool()(getTableSchema)
    mcp.tool()(queryTable)
    mcp.tool()(searchTable)
    mcp.tool()(getFieldOptions)
    mcp.tool()(query)
    return mcp


def create_fastmcp_server(name: str = "BaseQL MCP (Python)") -> Any:
    """
    Convenience factory for FastMCP users.

    Requires: pip install "baseql-mcp[fastmcp]"
    """
    try:
        from fastmcp import FastMCP
        from fastmcp.server.auth.providers.jwt import StaticTokenVerifier
    except ImportError as exc:  # pragma: no cover - informative failure path
        raise ImportError(
            "fastmcp is required to create a FastMCP server. "
            'Install with: pip install "baseql-mcp[fastmcp]" or pip install fastmcp'
        ) from exc

    api_key = os.getenv("FASTMCP_API_KEY") or os.getenv("MCP_API_KEY")
    if api_key:
        verifier = StaticTokenVerifier(
            tokens={
                api_key: {
                    "client_id": "baseql-api-key",
                    "scopes": ["baseql:access"],
                }
            },
            required_scopes=["baseql:access"],
        )
        mcp = FastMCP(name, auth=verifier)
    else:
        mcp = FastMCP(name)
    return register_tools(mcp)

