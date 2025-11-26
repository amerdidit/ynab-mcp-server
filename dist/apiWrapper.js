/**
 * YNAB API Wrapper with rate limit tracking
 *
 * This module creates a YNAB API client with middleware that captures
 * the X-Rate-Limit response header from each API call.
 */
import * as ynab from "ynab";
import { updateFromHeader, incrementRequestCount, getRateLimitWarningLevel } from "./rateLimit.js";
/**
 * Middleware that captures X-Rate-Limit header from responses
 */
const rateLimitMiddleware = {
    async post(context) {
        const rateLimitHeader = context.response.headers.get("X-Rate-Limit");
        if (rateLimitHeader) {
            const count = parseInt(rateLimitHeader, 10);
            if (!isNaN(count)) {
                updateFromHeader(count);
            }
        }
        else if (context.response.ok) {
            // Only increment on successful responses without header
            // Don't increment on errors (like 429) since we didn't consume a slot
            incrementRequestCount();
        }
        // Log warnings at high usage levels
        const level = getRateLimitWarningLevel();
        if (level === "warning") {
            console.error(`⚠️ Rate limit warning: Approaching limit`);
        }
        else if (level === "critical") {
            console.error(`🚨 Rate limit critical: Very close to limit`);
        }
        else if (level === "exceeded") {
            console.error(`❌ Rate limit exceeded: Requests may fail`);
        }
        return context.response;
    },
};
/**
 * Create a YNAB API instance with rate limit tracking middleware
 */
export function createTrackedApi(token) {
    // Create configuration with middleware
    const config = new ynab.Configuration({
        accessToken: token,
        middleware: [rateLimitMiddleware],
    });
    // The ynab.API class doesn't accept Configuration directly,
    // so we need to create it and then apply middleware to each sub-API
    const api = new ynab.API(token);
    // Apply middleware to all API sub-objects
    applyMiddleware(api, rateLimitMiddleware);
    return api;
}
/**
 * Apply middleware to all API sub-objects
 */
function applyMiddleware(api, middleware) {
    const subApis = [
        "user",
        "budgets",
        "accounts",
        "categories",
        "months",
        "payees",
        "payeeLocations",
        "transactions",
        "scheduledTransactions",
    ];
    for (const name of subApis) {
        const subApi = api[name];
        if (subApi && typeof subApi.withMiddleware === "function") {
            api[`_${name}`] = subApi.withMiddleware(middleware);
        }
    }
}
