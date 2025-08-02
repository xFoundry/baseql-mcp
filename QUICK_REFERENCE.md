# BaseQL MCP Quick Reference

## Common Commands in Claude Code

### Query Examples
```
"Using BaseQL, show me all contacts"
"Get the first 10 purchases sorted by date"
"Find contacts with email ending in @umd.edu"
"Show me the schema for the products table"
```

## BaseQL GraphQL Cheat Sheet

### Pagination
```graphql
contacts(_page_size: 10, _page: 2)
```

### Filtering
```graphql
contacts(_filter: {email: "test@example.com"})
purchases(_filter: {status: "completed"})
```

### Sorting
```graphql
products(_order_by: {price: "desc"})
contacts(_order_by: {lastName: "asc"})
```

### Multiple Arguments
```graphql
purchases(
  _filter: {status: "completed"}
  _order_by: {purchaseDate: "desc"}
  _page_size: 20
)
```

## Key Differences from Standard GraphQL

| Standard GraphQL | BaseQL |
|-----------------|---------|
| `Int` | `Float` |
| `limit: 10` | `_page_size: 10` |
| `offset: 20` | `_page: 3` (with _page_size: 10) |
| `where: {}` | `_filter: {}` |
| `orderBy: {}` | `_order_by: {}` |
| `"ASC"/"DESC"` | `"asc"/"desc"` |

## Common Field Types

- **String**: Text fields (id, name, email)
- **Float**: All numbers (amount, price, count)
- **List**: Arrays of linked records
- **Boolean**: True/false values
- **JSON**: Complex data (use String type)

## Troubleshooting Quick Fixes

1. **Error: "Unknown type Int"**
   → Change `Int` to `Float`

2. **Error: "Unknown argument limit"**
   → Use `_page_size` instead

3. **Error: "Syntax Error: Expected Name"**
   → Remove quotes from filter keys: `{email: "test"}` not `{"email": "test"}`

4. **Error: "invalid direction: 'ASC'"**
   → Use lowercase: `"asc"` or `"desc"`