# YNAB MCP Tools - TODO

## High Priority (Essential for daily operations)

- [x] **List Accounts** - Get all accounts with IDs (needed for `create_transaction`)
- [x] **Get Account** - Get a single account by ID with details
- [x] **List Categories** - Get all categories with IDs (needed for categorizing transactions)
- [x] **Sync Payees** - Sync payees from YNAB to local cache (uses delta sync with server_knowledge)
- [x] **Get Payee** - Get a single payee by ID from cache
- [x] **Search Payees** - Search/filter payees by name from cache (case-insensitive partial match)
- [x] **Rename Payee** - Rename a payee (only name is editable via API)
- [x] **List Payees** - Paginated list of all payees (useful for finding duplicates)
- [ ] **Update Transaction** - Edit existing transactions (category, payee, memo, amount, etc.)
- [x] **Search Transactions** - Search/filter transaction history with date range, amount, payee, category, memo, status filters

## Nice to Have

- [ ] **Category Transfer** - Move money between categories
- [ ] **Get Account Balances** - Quick balance check for specific accounts
- [ ] **Scheduled Transactions** - View/manage recurring transactions
- [ ] **Pagination & Filtering** - Add pagination/filtering to list tools to handle large datasets (accounts, categories, transactions)
- [ ] **Clear Payee Cache** - Tool to clear local payee cache for troubleshooting
- [x] **Apply Caching to Categories** - Categories now use delta sync caching like payees
  - `sync_categories` - Sync categories to local cache
  - `search_categories` - Search categories by name
  - `get_category` - Get single category by ID
  - `list_categories` - Now uses cache by default
