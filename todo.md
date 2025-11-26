# YNAB MCP Tools - TODO

## High Priority (Essential for daily operations)

- [x] **List Accounts** - Get all accounts with IDs (needed for `create_transaction`)
- [x] **Get Account** - Get a single account by ID with details
- [x] **List Categories** - Get all categories with IDs (needed for categorizing transactions)
- [x] **Sync Payees** - Sync payees from YNAB to local cache (uses delta sync with server_knowledge)
- [x] **Get Payee** - Get a single payee by ID from cache
- [x] **Search Payees** - Search/filter payees by name from cache (case-insensitive partial match)
- [ ] **Update Transaction** - Edit existing transactions (category, payee, memo, amount, etc.)
- [ ] **Search Transactions** - Search/filter transaction history beyond unapproved

## Nice to Have

- [ ] **Category Transfer** - Move money between categories
- [ ] **Get Account Balances** - Quick balance check for specific accounts
- [ ] **Scheduled Transactions** - View/manage recurring transactions
- [ ] **Pagination & Filtering** - Add pagination/filtering to list tools to handle large datasets (accounts, categories, transactions)
- [ ] **Clear Payee Cache** - Tool to clear local payee cache for troubleshooting
- [ ] **Apply Caching to Categories/Accounts** - Extend caching pattern to other large datasets
