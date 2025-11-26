# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm install          # Install dependencies
npm run build        # Build (compiles TypeScript)
npm start            # Start the server
npm run watch        # Development build with file watching
npm run debug        # Debug MCP server with inspector
npm test             # Run tests
npm test:watch       # Run tests with file watching
npm test:coverage    # Run tests with coverage report
```

## Architecture Overview

This is an **MCP server** for interacting with YNAB (You Need A Budget) budgets via AI conversations.

### Structure
- **Entry Point**: `src/index.ts` - Server setup, tool registration, YNAB API client initialization
- **Tools**: `src/tools/*.ts` - Each tool is a separate module exporting `name`, `description`, `inputSchema`, and `execute()`
- **Tests**: `src/tests/*.test.ts` - Vitest tests with mocked YNAB API

### Tool Module Pattern
Tools are separate files that export:
```typescript
export const name = "tool_name";
export const description = "What it does";
export const inputSchema = { /* zod schema or object */ };
export async function execute(input: InputType, api: ynab.API) {
  // Return { content: [{ type: "text", text: "..." }] }
}
```

Tools are registered in `src/index.ts`:
```typescript
server.registerTool(MyTool.name, {
  title: "My Tool",
  description: MyTool.description,
  inputSchema: MyTool.inputSchema,
}, async (input) => MyTool.execute(input, api));
```

### Budget ID Helper Pattern
Tools that need a budget ID should use this pattern:
```typescript
function getBudgetId(inputBudgetId?: string): string {
  const budgetId = inputBudgetId || process.env.YNAB_BUDGET_ID || "";
  if (!budgetId) throw new Error("No budget ID provided...");
  return budgetId;
}
```

### Environment Variables
- `YNAB_API_TOKEN` (required) - Personal Access Token from YNAB API
- `YNAB_BUDGET_ID` (optional) - Default budget ID

## Adding New Tools

1. Create `src/tools/MyTool.ts` following the module pattern above
2. Import and register in `src/index.ts`
3. Create `src/tests/MyTool.test.ts` with mocked YNAB API
4. Reference YNAB types from `node_modules/ynab/dist/index.d.ts` (check `models/` subfolder for specific types)
5. Use YNAB OpenAPI spec at `https://api.ynab.com/papi/open_api_spec.yaml` for API reference

### Test Pattern
```typescript
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import * as ynab from 'ynab';
import * as MyTool from '../tools/MyTool';

vi.mock('ynab');

describe('MyTool', () => {
  let mockApi: { /* mock structure */ };
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = { /* setup mocks */ };
    (ynab.API as any).mockImplementation(() => mockApi);
    process.env.YNAB_API_TOKEN = 'test-token';
  });
  // tests...
});
```

### Response Format
All tools return: `{ content: [{ type: "text" as const, text: "..." }] }`

YNAB amounts are in milliunits - divide by 1000 for dollars.