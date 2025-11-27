[![MseeP.ai Security Assessment Badge](https://mseep.net/mseep-audited.png)](https://mseep.ai/app/calebl-ynab-mcp-server)

# ynab-mcp-server
[![smithery badge](https://smithery.ai/badge/@calebl/ynab-mcp-server)](https://smithery.ai/server/@calebl/ynab-mcp-server)

A Model Context Protocol (MCP) server built with mcp-framework. This MCP provides tools
for interacting with your YNAB budgets setup at https://ynab.com

<a href="https://glama.ai/mcp/servers/@calebl/ynab-mcp-server">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@calebl/ynab-mcp-server/badge" alt="YNAB Server MCP server" />
</a>

In order to have an AI interact with this tool, you will need to get your Personal Access Token
from YNAB: https://api.ynab.com/#personal-access-tokens. When adding this MCP server to any
client, you will need to provide your personal access token as YNAB_API_TOKEN. **This token
is never directly sent to the LLM.** It is stored privately in an environment variable for
use with the YNAB api.

## Setup
Specify env variables:
* YNAB_API_TOKEN (required)
* YNAB_BUDGET_ID (optional)

## Goal
The goal of the project is to be able to interact with my YNAB budget via an AI conversation.
There are a few primary workflows I want to enable:

## Workflows:
### First time setup
* be prompted to select your budget from your available budgets. If you try to use another
tool first, this prompt should happen asking you to set your default budget.
  * Tools needed: ListBudgets
### Manage overspent categories
### Adding new transactions
### Approving transactions
### Check total monthly spending vs total income
### Auto-distribute ready to assign funds based on category targets

## Current state
Available tools:
* ListBudgets - lists available budgets on your account
* ListAccounts - lists all accounts with IDs, names, types, and balances
* GetAccount - gets a single account by ID with detailed information
* ListCategories - lists all categories organized by category group with budget amounts (uses cache)
* SyncCategories - syncs categories from YNAB to local cache, returns count and sync stats
* SearchCategories - searches categories by name or group name (case-insensitive partial match) from local cache
* GetCategory - gets a single category by ID from local cache
* SyncPayees - syncs payees from YNAB to local cache, returns count and sync stats
* ListPayees - lists all payees with pagination, sorted alphabetically (useful for finding duplicates)
* SearchPayees - searches payees by name (case-insensitive partial match) from local cache
* GetPayee - gets a single payee by ID from local cache
* RenamePayee - renames a payee (updates both YNAB and local cache)
* BudgetSummary - provides a summary of categories that are underfunded and accounts that are low
* GetUnapprovedTransactions - retrieve all unapproved transactions
* CreateTransaction - creates a transaction for a specified budget and account.
  * supports split transactions with multiple categories/payees
  * example prompt: `Add a transaction to my Ally account for $3.98 I spent at REI today`
  * example split: `Add a $100 transaction split between Groceries ($60) and Household ($40)`
  * requires ListAccounts to be called first so we know the account id
* ApproveTransaction - approves an existing transaction in your YNAB budget
  * requires a transaction ID to approve
  * can be used in conjunction with GetUnapprovedTransactions to approve pending transactions
  * After calling get unapproved transactions, prompt: `approve the transaction for $6.95 on the Apple Card`
* DeleteTransaction - permanently deletes a transaction from your YNAB budget
  * requires a transaction ID to delete
  * this action cannot be undone
* SearchTransactions - searches transactions with flexible filtering options
  * filter by date range, amount range, payee, category, memo text, cleared/approved status, flag color
  * supports uncategorized transaction filtering
  * `excludeBudgetTransfers` - exclude transfers between on-budget accounts
  * `excludeTrackingAccounts` - exclude transactions from tracking (off-budget) accounts like investments, assets, loans
  * example prompt: `Find all transactions at Amazon in the last 30 days`
  * example prompt: `Find uncategorized transactions excluding tracking accounts`
* UpdateTransaction - updates an existing transaction
  * can modify any combination of: category, payee, memo, amount, date, cleared status, approved status, flag color
  * can convert a regular transaction to a split transaction
  * example prompt: `Change the category of that transaction to Groceries`
  * example split: `Split that transaction between Dining Out ($30) and Groceries ($20)`
* GetRateLimitStatus - shows current YNAB API rate limit usage
  * YNAB allows 200 requests per hour in a rolling window
  * tracks usage via X-Rate-Limit header from API responses
  * shows warning levels: ok, warning (75%), critical (90%), exceeded (100%)

### Local Caching

Payee and category tools use local caching to work around two limitations:

1. **YNAB API Limitation**: The YNAB API doesn't support pagination or filtering for payees/categories. A single request returns the entire dataset, which can be 1000+ payees and 150+ categories for long-running budgets.

2. **MCP Response Truncation**: Large MCP tool responses get truncated by LLM context limits, causing incomplete data to be returned to the AI.

**How it works:**
- Caches are stored at `~/.ynab-mcp/cache/<budget-id>/`
- Uses YNAB's `server_knowledge` for efficient delta syncs (only fetches changes since last sync)
- Tools that read from cache auto-sync if cache is empty
- Run `sync_payees` or `sync_categories` to manually refresh the cache

### Rate Limit Tracking

The server tracks YNAB API rate limit usage to help avoid hitting the 200 requests/hour limit:

- Captures the `X-Rate-Limit` header from every YNAB API response
- Persists count to `~/.ynab-mcp/cache/rate-limit.json` across sessions
- Use `get_rate_limit_status` tool to check current usage
- Shows staleness warning if data is >1 hour old (YNAB uses rolling window)

Next:
* Category Transfer - move money between categories
* Scheduled Transactions - view/manage recurring transactions
* Batch operations - approve multiple transactions with 1 call


## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

```

## Project Structure

```
ynab-mcp-server/
├── src/
│   ├── tools/        # MCP Tools
│   └── index.ts      # Server entry point
├── .cursor/
│   └── rules/        # Cursor AI rules for code generation
├── package.json
└── tsconfig.json
```

## Adding Components

The YNAB sdk describes the available api endpoints: https://github.com/ynab/ynab-sdk-js.

YNAB open api specification is here: https://api.ynab.com/papi/open_api_spec.yaml. This can
be used to prompt an AI to generate a new tool. Example prompt for Cursor Agent:

```
create a new tool based on the readme and this openapi doc: https://api.ynab.com/papi/open_api_spec.yaml

The new tool should get the details for a single budget
```

You can add more tools using the CLI:

```bash
# Add a new tool
mcp add tool my-tool

# Example tools you might create:
mcp add tool data-processor
mcp add tool api-client
mcp add tool file-handler
```

## Tool Development

Example tool structure:

```typescript
import { MCPTool } from "mcp-framework";
import { z } from "zod";

interface MyToolInput {
  message: string;
}

class MyTool extends MCPTool<MyToolInput> {
  name = "my_tool";
  description = "Describes what your tool does";

  schema = {
    message: {
      type: z.string(),
      description: "Description of this input parameter",
    },
  };

  async execute(input: MyToolInput) {
    // Your tool logic here
    return `Processed: ${input.message}`;
  }
}

export default MyTool;
```

## Publishing to npm

1. Update your package.json:
   - Ensure `name` is unique and follows npm naming conventions
   - Set appropriate `version`
   - Add `description`, `author`, `license`, etc.
   - Check `bin` points to the correct entry file

2. Build and test locally:
   ```bash
   npm run build
   npm link
   ynab-mcp-server  # Test your CLI locally
   ```

3. Login to npm (create account if necessary):
   ```bash
   npm login
   ```

4. Publish your package:
   ```bash
   npm publish
   ```

After publishing, users can add it to their claude desktop client (read below) or run it with npx


## Using with Claude Desktop

### Installing via Smithery

To install YNAB Budget Assistant for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@calebl/ynab-mcp-server):

```bash
npx -y @smithery/cli install @calebl/ynab-mcp-server --client claude
```

### Local Development

Add this configuration to your Claude Desktop config file:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ynab-mcp-server": {
      "command": "node",
      "args":["/absolute/path/to/ynab-mcp-server/dist/index.js"]
    }
  }
}
```

### After Publishing

Add this configuration to your Claude Desktop config file:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ynab-mcp-server": {
      "command": "npx",
      "args": ["ynab-mcp-server"]
    }
  }
}
```

### Other MCP Clients
Check https://modelcontextprotocol.io/clients for other available clients.

## Building and Testing

1. Make changes to your tools
2. Run `npm run build` to compile
3. The server will automatically load your tools on startup

## Learn More

- [MCP Framework Github](https://github.com/QuantGeekDev/mcp-framework)
- [MCP Framework Docs](https://mcp-framework.com)
