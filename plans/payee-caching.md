# Payee Caching Implementation Plan

## Problem
MCP client truncates large tool responses. With hundreds of payees, `list_payees` gets truncated and data is lost.

## Solution
Cache payees locally, return summaries to Claude, search/filter from cache. Use YNAB's `server_knowledge` for efficient delta sync.

## How server_knowledge Works

YNAB returns a `server_knowledge` cursor with each response:

```
# First request (no cache)
GET /budgets/{id}/payees
→ Returns: all 500 payees + server_knowledge: 12345

# Later request (with cache)
GET /budgets/{id}/payees?last_knowledge_of_server=12345
→ Returns: only changed payees + server_knowledge: 12348
```

If nothing changed, returns empty list + same server_knowledge. **Very cheap call.**

**Key insight**: No time-based staleness needed. Every tool call does a delta sync first - it's fast when nothing changed, and the cache is always accurate.

## Architecture

```
~/.ynab-mcp/
└── cache/
    └── {budget_id}/
        ├── payees.json
        ├── categories.json  (future)
        └── accounts.json    (future)
```

### Cache File Structure (`payees.json`)
```json
{
  "server_knowledge": 12345,
  "last_synced": "2024-11-26T16:30:00Z",
  "payees": [
    {
      "id": "abc-123",
      "name": "Amazon",
      "deleted": false,
      "transfer_account_id": null
    }
  ]
}
```

## Implementation Steps

### Step 1: Cache Module
Create `src/cache/index.ts`:
- `getCacheDir(budgetId)` - Returns/creates `~/.ynab-mcp/cache/{budgetId}/`
- `readCache<T>(budgetId, filename)` - Read JSON cache file
- `writeCache<T>(budgetId, filename, data)` - Write JSON cache file

Create `src/cache/payees.ts`:
- `syncPayees(budgetId, api)` - Delta sync payees to cache, returns stats
- `getPayeesFromCache(budgetId)` - Read payees from cache (no sync)

### Step 2: Update ListPayeesTool
Modify existing tool:
- **New behavior**:
  1. Delta sync (fast if nothing changed)
  2. Return summary only:
  ```json
  {
    "payee_count": 500,
    "synced": true,
    "changes": { "new": 0, "updated": 0, "deleted": 0 },
    "hint": "Use search_payees to find specific payees"
  }
  ```

### Step 3: Update SearchPayeesTool
Modify existing tool:
- **New behavior**:
  1. Delta sync first (always fresh)
  2. Search locally (case-insensitive, partial match)
  3. Return matching payees (limited to avoid truncation)
- **Add parameters**:
  - `limit: number` - Max results to return (default 50)

### Step 4: Update GetPayeeTool
Modify existing tool:
- **New behavior**:
  1. Delta sync first
  2. Return payee from cache
  3. If not found in cache, return error (payee doesn't exist or was deleted)

## Tool Behavior Summary

| Tool | Action | Returns |
|------|--------|---------|
| `list_payees` | Delta sync → summary | Count + sync stats |
| `search_payees` | Delta sync → filter | Matching payees (max 50) |
| `get_payee` | Delta sync → lookup | Single payee |

**All tools delta sync first** - ensures fresh data with minimal API cost.

## Delta Sync Logic

```typescript
interface PayeesCache {
  server_knowledge: number;
  last_synced: string;
  payees: Payee[];
}

interface SyncStats {
  total: number;
  new: number;
  updated: number;
  deleted: number;
}

async function syncPayees(budgetId: string, api: ynab.API): Promise<{ cache: PayeesCache; stats: SyncStats }> {
  const existing = readCache<PayeesCache>(budgetId, 'payees.json');

  // Fetch from API (delta if we have server_knowledge)
  const response = await api.payees.getPayees(
    budgetId,
    existing?.server_knowledge  // undefined = full fetch
  );

  const stats: SyncStats = { total: 0, new: 0, updated: 0, deleted: 0 };
  let cache: PayeesCache;

  if (existing) {
    // Merge delta into existing cache
    cache = { ...existing };

    for (const payee of response.data.payees) {
      const idx = cache.payees.findIndex(p => p.id === payee.id);
      if (idx >= 0) {
        if (payee.deleted && !cache.payees[idx].deleted) {
          stats.deleted++;
        } else {
          stats.updated++;
        }
        cache.payees[idx] = payee;
      } else {
        stats.new++;
        cache.payees.push(payee);
      }
    }

    cache.server_knowledge = response.data.server_knowledge;
    cache.last_synced = new Date().toISOString();
  } else {
    // Fresh cache (first sync)
    cache = {
      server_knowledge: response.data.server_knowledge,
      last_synced: new Date().toISOString(),
      payees: response.data.payees
    };
    stats.new = response.data.payees.length;
  }

  stats.total = cache.payees.filter(p => !p.deleted).length;
  writeCache(budgetId, 'payees.json', cache);

  return { cache, stats };
}
```

## File Changes

### New Files
- `src/cache/index.ts` - Generic cache utilities (read/write/paths)
- `src/cache/payees.ts` - Payee sync logic
- `src/tests/cache.test.ts` - Cache unit tests

### Modified Files
- `src/tools/ListPayeesTool.ts` - Delta sync + summary response
- `src/tools/SearchPayeesTool.ts` - Delta sync + cache search + limit param
- `src/tools/GetPayeeTool.ts` - Delta sync + cache lookup
- `src/index.ts` - No changes needed (same tools, different behavior)

## Future Extensions
- Apply same pattern to categories and accounts
- Add `sync_all` tool to refresh everything at once
- Add `clear_cache` tool for troubleshooting
- Consider: skip delta sync if last_synced < 1 minute ago (optimization)
