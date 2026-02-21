# XLSX Template (Sheet1)

Create an Excel file with a first sheet named `Sheet1` and these headers in row 1:

| date | menuItemName | qtySold | revenue | channel |
|------|--------------|---------|---------|---------|
| 2026-02-10 | Classic Burger | 42 | 504.00 | Dine In |
| 2026-02-10 | Caesar Salad | 19 | 247.00 | Online |

Notes:
- `date`, `menuItemName`, and `qtySold` are required for commit imports.
- `revenue` and `channel` are optional.
- Additional columns are allowed; map only what you need in the import mapping UI.
- Date values should be valid Excel dates or ISO strings (`YYYY-MM-DD`).
