/**
 * Rate limit tracker for YNAB API
 *
 * YNAB allows 200 requests per hour in a rolling window.
 * The API returns the current usage count in the X-Rate-Limit response header.
 * This module captures that header via middleware and persists it to cache.
 */

import { readGlobalCache, writeGlobalCache } from "./cache/index.js";

const RATE_LIMIT = 200;
const CACHE_FILENAME = "rate-limit.json";

interface RateLimitCache {
  requestsUsed: number;
  lastUpdated: number;
}

// In-memory state
let requestsUsed = 0;
let lastUpdated: number | null = null;
let cacheLoaded = false;

/**
 * Load rate limit data from cache if not already loaded
 */
function ensureCacheLoaded(): void {
  if (cacheLoaded) return;

  const cached = readGlobalCache<RateLimitCache>(CACHE_FILENAME);
  if (cached) {
    requestsUsed = cached.requestsUsed;
    lastUpdated = cached.lastUpdated;
  }
  cacheLoaded = true;
}

/**
 * Save rate limit data to cache
 */
function saveToCache(): void {
  writeGlobalCache<RateLimitCache>(CACHE_FILENAME, {
    requestsUsed,
    lastUpdated: lastUpdated || Date.now(),
  });
}

/**
 * Update rate limit from X-Rate-Limit header value
 * Called by the API middleware after each response
 */
export function updateFromHeader(headerValue: number): void {
  ensureCacheLoaded();
  requestsUsed = headerValue;
  lastUpdated = Date.now();
  saveToCache();
}

/**
 * Increment request count (fallback when header not available)
 */
export function incrementRequestCount(): void {
  ensureCacheLoaded();
  requestsUsed++;
  lastUpdated = Date.now();
  saveToCache();
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(): {
  requestsUsed: number;
  requestsRemaining: number;
  limit: number;
  percentUsed: number;
  lastUpdated: number | null;
  lastUpdatedAgo: string | null;
} {
  ensureCacheLoaded();

  const requestsRemaining = Math.max(0, RATE_LIMIT - requestsUsed);

  let lastUpdatedAgo: string | null = null;
  if (lastUpdated) {
    const agoMs = Date.now() - lastUpdated;
    const agoMinutes = Math.floor(agoMs / 60000);
    if (agoMinutes < 1) {
      lastUpdatedAgo = "just now";
    } else if (agoMinutes === 1) {
      lastUpdatedAgo = "1 minute ago";
    } else if (agoMinutes < 60) {
      lastUpdatedAgo = `${agoMinutes} minutes ago`;
    } else {
      const agoHours = Math.floor(agoMinutes / 60);
      lastUpdatedAgo = `${agoHours} hour${agoHours > 1 ? "s" : ""} ago`;
    }
  }

  return {
    requestsUsed,
    requestsRemaining,
    limit: RATE_LIMIT,
    percentUsed: Math.round((requestsUsed / RATE_LIMIT) * 100),
    lastUpdated,
    lastUpdatedAgo,
  };
}

/**
 * Check if we're approaching the rate limit
 * Returns a warning level: "ok", "warning", "critical", "exceeded"
 */
export function getRateLimitWarningLevel(): "ok" | "warning" | "critical" | "exceeded" {
  const { percentUsed } = getRateLimitStatus();

  if (percentUsed >= 100) return "exceeded";
  if (percentUsed >= 90) return "critical";
  if (percentUsed >= 75) return "warning";
  return "ok";
}

/**
 * Check if the cached data is potentially stale (older than 1 hour)
 * Since YNAB uses a rolling 1-hour window, data older than that may be inaccurate
 */
export function isDataStale(): boolean {
  ensureCacheLoaded();
  if (!lastUpdated) return true;
  const ageMs = Date.now() - lastUpdated;
  return ageMs > 60 * 60 * 1000; // 1 hour
}

/**
 * Format the rate limit status as a human-readable string
 */
export function formatRateLimitStatus(): string {
  const status = getRateLimitStatus();
  const level = getRateLimitWarningLevel();
  const stale = isDataStale();

  let message = `YNAB API Rate Limit: ${status.requestsUsed}/${status.limit} requests used (${status.percentUsed}%)`;
  message += `\nRemaining: ${status.requestsRemaining} requests`;

  if (status.lastUpdatedAgo) {
    message += `\nLast updated: ${status.lastUpdatedAgo}`;
  }

  if (stale) {
    message += "\n⏰ Note: Data may be stale. Make an API call to refresh from YNAB.";
  }

  if (level === "warning") {
    message += "\n⚠️ Warning: Approaching rate limit";
  } else if (level === "critical") {
    message += "\n🚨 Critical: Very close to rate limit";
  } else if (level === "exceeded") {
    message += "\n❌ Rate limit exceeded - requests will fail";
  }

  return message;
}

/**
 * Reset the tracker (mainly for testing)
 */
export function resetTracker(): void {
  requestsUsed = 0;
  lastUpdated = null;
  cacheLoaded = true; // Mark as loaded to avoid reading stale cache
}

/**
 * Get current request count (for testing)
 */
export function getRequestCount(): number {
  ensureCacheLoaded();
  return requestsUsed;
}
