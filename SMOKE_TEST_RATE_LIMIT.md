# Smoke Test: Rate Limit Tracking

Manual verification that rate limit tracking captures the X-Rate-Limit header and persists to cache.

## Prerequisites

- [ ] YNAB API token configured (`YNAB_API_TOKEN`)
- [ ] MCP server built (`npm run build`)
- [ ] Cache cleared (optional): `rm ~/.ynab-mcp/cache/rate-limit.json`

---

## Test 1: Initial State (No Requests Yet)

**Call**: `get_rate_limit_status`

**Expected**:
```json
{
  "requestsUsed": 0,
  "requestsRemaining": 200,
  "limit": 200,
  "percentUsed": 0,
  "warningLevel": "ok",
  "lastUpdated": null
}
```

- [ ] Shows 0 requests used
- [ ] `lastUpdated` is null (no API calls made yet)

---

## Test 2: After First API Call

**Call**: `list_budgets`

Then immediately call: `get_rate_limit_status`

**Expected**:
- [ ] `requestsUsed` is now > 0 (should match your actual YNAB usage)
- [ ] `lastUpdated` shows "just now"
- [ ] `warningLevel` is "ok" (unless you've made 150+ requests this hour)

---

## Test 3: Cache Persistence

1. Note the `requestsUsed` value from Test 2
2. **Stop the MCP server** (Ctrl+C or restart Claude Desktop)
3. **Start the MCP server again**
4. **Call**: `get_rate_limit_status`

**Expected**:
- [ ] `requestsUsed` matches the value from before restart
- [ ] `lastUpdated` shows time since last API call (e.g., "2 minutes ago")

---

## Test 4: Verify Cache File

**Check file**: `~/.ynab-mcp/cache/rate-limit.json`

```bash
cat ~/.ynab-mcp/cache/rate-limit.json
```

**Expected format**:
```json
{
  "requestsUsed": <number>,
  "lastUpdated": <timestamp>
}
```

- [ ] File exists
- [ ] Contains valid JSON with both fields

---

## Test 5: Count Updates After Multiple Calls

Make several API calls:
1. `list_budgets`
2. `list_accounts` (with a budget ID)
3. `list_categories` (with a budget ID)

Then call: `get_rate_limit_status`

**Expected**:
- [ ] `requestsUsed` increased by ~3 from before
- [ ] `lastUpdated` shows "just now"

---

## Test 6: Warning Levels (Optional - High Usage)

If you're able to get close to the limit (or want to test manually):

| Usage | Expected `warningLevel` |
|-------|------------------------|
| 0-149 (0-74%) | `ok` |
| 150-179 (75-89%) | `warning` |
| 180-199 (90-99%) | `critical` |
| 200+ (100%+) | `exceeded` |

- [ ] Warning level matches usage percentage

---

## Test 7: Console Warnings (Optional)

If you're at 75%+ usage, check server stderr for warning messages:

- [ ] At 75%+: `⚠️ Rate limit warning: Approaching limit`
- [ ] At 90%+: `🚨 Rate limit critical: Very close to limit`
- [ ] At 100%+: `❌ Rate limit exceeded: Requests may fail`

---

## Troubleshooting

### Cache not updating?
- Check file permissions on `~/.ynab-mcp/cache/`
- Verify API calls are succeeding (check for errors)

### Count seems wrong?
- The count comes from YNAB's `X-Rate-Limit` header
- It reflects ALL requests to YNAB with your token (including other apps)
- YNAB uses a rolling 1-hour window

### Header not being captured?
- Check if YNAB changed their API (unlikely)
- Fallback: count will increment locally instead

---

## Test Results

| Test | Pass/Fail | Notes |
|------|-----------|-------|
| 1. Initial state | | |
| 2. After first call | | |
| 3. Cache persistence | | |
| 4. Cache file format | | |
| 5. Multiple calls | | |
| 6. Warning levels | | |
| 7. Console warnings | | |

**Tested By**: _______________
**Date**: _______________
**Server Version**: _______________
