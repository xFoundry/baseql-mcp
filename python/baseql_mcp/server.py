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


def _build_selection(selection: Any, indent_level: int = 0) -> str:
    """Build a GraphQL selection set from lists/dicts/strings."""
    indent = "    " * indent_level
    if isinstance(selection, str):
        return f"{indent}{selection}"
    if isinstance(selection, list):
        return "\n".join(_build_selection(item, indent_level) for item in selection)
    if isinstance(selection, dict):
        blocks: List[str] = []
        for key, value in selection.items():
            nested = _build_selection(value, indent_level + 1)
            blocks.append(f"{indent}{key} {{\n{nested}\n{indent}}}")
        return "\n".join(blocks)
    raise ValueError("selection must be a string, list, or dict")


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
    selection: Optional[Any] = None,
    safeFields: bool = False,
    validateFields: bool = False,
) -> Dict[str, Any]:
    """Query a table with filters, sorting, and pagination.

    filter is passed directly to BaseQL _filter (supports _eq/_in/_and/_or/etc).
    Exact matches are case-sensitive unless you use advanced operators.
    """
    if not tableName:
        raise ValueError("tableName is required")
    if selection is not None and fields:
        raise ValueError("Provide either selection or fields, not both")

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
    selection_str = "id\n    __typename"
    if selection is not None:
        selection_str = _build_selection(selection)
    elif fields:
        if safeFields or validateFields:
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
            allowed_fields = {
                f["name"]
                for f in field_defs
                if f.get("type", {}).get("kind") == "SCALAR" or not safeFields
            }
            filtered_fields = [f for f in fields if f in allowed_fields]
            if not filtered_fields:
                raise ValueError(
                    f"No valid fields found in '{tableName}'. "
                    "Use getTableSchema to list available fields."
                )
            fields = filtered_fields
        selection_str = "\n    ".join(fields)

    query = f"""
    query QueryTable {{
      {tableName}{args_str} {{
        {selection_str}
      }}
    }}
    """
    data = await _graphql_request(query)
    return data


async def searchTable(
    tableName: str,
    searchTerm: Any,
    fields: Optional[List[str]] = None,
    limit: int = 10,
    matchMode: str = "exact",
    caseInsensitive: bool = True,
) -> Dict[str, Any]:
    """Search by match across specific string fields.

    Exact matching is case-sensitive on the BaseQL side. When caseInsensitive=True
    or matchMode="contains", the tool uses client-side matching on a limited
    sample (may miss matches beyond the sample size).
    """
    if not tableName:
        raise ValueError("tableName is required")
    if not searchTerm:
        raise ValueError("searchTerm is required")
    if limit <= 0 or limit > 100:
        raise ValueError("limit must be between 1 and 100")

    mode = (matchMode or "exact").strip().lower()
    if mode not in ("exact", "contains", "in", "nin"):
        raise ValueError('matchMode must be "exact", "contains", "in", or "nin"')

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

    available_text_fields = []
    available_text_list_fields = []
    for field in field_defs:
        field_type = field.get("type", {})
        if field_type.get("kind") == "SCALAR" and field_type.get("name") == "String":
            available_text_fields.append(field["name"])
        elif (
            field_type.get("kind") == "LIST"
            and field_type.get("ofType", {}).get("name") == "String"
        ):
            available_text_list_fields.append(field["name"])

    if not fields:
        fields_to_search = available_text_fields + available_text_list_fields
    else:
        fields_to_search = [
            f for f in fields if f in available_text_fields or f in available_text_list_fields
        ]
    if not fields_to_search:
        raise ValueError(
            f"No valid string fields found in '{tableName}' for search. "
            "Use getTableSchema to list available fields."
        )

    if mode in ("in", "nin"):
        if not isinstance(searchTerm, (list, tuple, set)):
            raise ValueError('searchTerm must be a list when matchMode is "in" or "nin"')
        terms = [str(term) for term in searchTerm]
        if not terms:
            raise ValueError('searchTerm must contain at least one value')
    else:
        terms = [str(searchTerm)]

    primary_field = fields_to_search[0]
    result_fields = ["id"] + fields_to_search[:10]
    selection = "\n    ".join(result_fields)

    # BaseQL server-side filters are case-sensitive; fall back to client-side matching
    # when case-insensitive or contains behavior is requested.
    if caseInsensitive or mode == "contains":
        sample_size = min(max(limit * 5, limit), 100)
        query = f"""
        query SearchTableSample {{
          {tableName}(_page_size: {sample_size}) {{
            {selection}
          }}
        }}
        """
        data = await _graphql_request(query)
        records = data.get(tableName, [])
        needles = [term.lower() for term in terms] if caseInsensitive else terms

        def _matches(value: Any) -> bool:
            if value is None:
                return False
            if isinstance(value, list):
                return any(_matches(item) for item in value)
            hay = str(value)
            hay = hay.lower() if caseInsensitive else hay
            if mode == "contains":
                return any(needle in hay for needle in needles)
            if mode == "in":
                return hay in needles
            if mode == "nin":
                return hay not in needles
            return hay == needles[0]

        matched: Dict[str, Dict[str, Any]] = {}
        for record in records:
            for field in fields_to_search:
                if _matches(record.get(field)):
                    record_id = record.get("id") or record.get("_id")
                    if record_id:
                        matched[record_id] = record
                    else:
                        matched[str(record)] = record
                    break

        results = list(matched.values())[:limit]
        return {
            "searchTerm": searchTerm,
            "fieldsSearched": fields_to_search,
            "primaryField": primary_field,
            "matchMode": mode,
            "caseInsensitive": caseInsensitive,
            "sampleSize": sample_size,
            "records": results,
            "results": {"records": results, "note": "Client-side filtering on a limited sample."},
        }

    server_fields = [f for f in fields_to_search if f in available_text_fields]
    if not server_fields:
        raise ValueError(
            f"No valid string fields found in '{tableName}' for server-side search. "
            "Use getTableSchema to list available fields."
        )

    if mode == "exact":
        op_key = "_eq"
    elif mode == "in":
        op_key = "_in"
    else:
        op_key = "_nin"

    or_filters = [{field: {op_key: terms if mode in ("in", "nin") else terms[0]}} for field in server_fields]
    filter_obj = {"_or": or_filters} if len(or_filters) > 1 else or_filters[0]
    args = [
        f"_filter: {_to_graphql_object(filter_obj)}",
        f"_page_size: {min(limit, 100)}",
    ]
    args_str = f"({', '.join(args)})"
    query = f"""
    query SearchTable {{
      {tableName}{args_str} {{
        {selection}
      }}
    }}
    """
    data = await _graphql_request(query)
    records = data.get(tableName, [])
    return {
        "searchTerm": searchTerm,
        "fieldsSearched": server_fields,
        "primaryField": primary_field,
        "matchMode": mode,
        "caseInsensitive": caseInsensitive,
        "records": records[:limit],
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

