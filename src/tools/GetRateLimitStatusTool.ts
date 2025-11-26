import { getRateLimitStatus, getRateLimitWarningLevel, formatRateLimitStatus, isDataStale } from "../rateLimit.js";

export const name = "get_rate_limit_status";
export const description = "Get the current YNAB API rate limit status. YNAB allows 200 requests per hour in a rolling window. The count is updated from the X-Rate-Limit response header after each API call. If data is stale (>1 hour old), make any API call to refresh.";
export const inputSchema = {};

export async function execute(_input: Record<string, never>) {
  const status = getRateLimitStatus();
  const level = getRateLimitWarningLevel();
  const stale = isDataStale();

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        requestsUsed: status.requestsUsed,
        requestsRemaining: status.requestsRemaining,
        limit: status.limit,
        percentUsed: status.percentUsed,
        warningLevel: level,
        lastUpdated: status.lastUpdatedAgo,
        isStale: stale,
        message: formatRateLimitStatus(),
      }, null, 2)
    }]
  };
}
