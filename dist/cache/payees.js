import { readCache, writeCache } from "./index.js";
const PAYEES_CACHE_FILE = "payees.json";
/**
 * Sync payees from YNAB API to local cache using delta sync.
 * If cache exists, only fetches changes since last sync.
 * Returns the updated cache and sync statistics.
 */
export async function syncPayees(budgetId, api) {
    const existing = readCache(budgetId, PAYEES_CACHE_FILE);
    // Fetch from API (delta if we have server_knowledge)
    const response = await api.payees.getPayees(budgetId, existing?.server_knowledge);
    const stats = { total: 0, new: 0, updated: 0, deleted: 0 };
    let cache;
    if (existing) {
        // Merge delta into existing cache
        cache = { ...existing };
        for (const payee of response.data.payees) {
            const idx = cache.payees.findIndex((p) => p.id === payee.id);
            if (idx >= 0) {
                // Existing payee - check if deleted or updated
                if (payee.deleted && !cache.payees[idx].deleted) {
                    stats.deleted++;
                }
                else if (!payee.deleted) {
                    stats.updated++;
                }
                cache.payees[idx] = {
                    id: payee.id,
                    name: payee.name,
                    deleted: payee.deleted,
                    transfer_account_id: payee.transfer_account_id || null,
                };
            }
            else {
                // New payee
                stats.new++;
                cache.payees.push({
                    id: payee.id,
                    name: payee.name,
                    deleted: payee.deleted,
                    transfer_account_id: payee.transfer_account_id || null,
                });
            }
        }
        cache.server_knowledge = response.data.server_knowledge;
        cache.last_synced = new Date().toISOString();
    }
    else {
        // Fresh cache (first sync)
        cache = {
            server_knowledge: response.data.server_knowledge,
            last_synced: new Date().toISOString(),
            payees: response.data.payees.map((payee) => ({
                id: payee.id,
                name: payee.name,
                deleted: payee.deleted,
                transfer_account_id: payee.transfer_account_id || null,
            })),
        };
        stats.new = response.data.payees.filter((p) => !p.deleted).length;
    }
    stats.total = cache.payees.filter((p) => !p.deleted).length;
    writeCache(budgetId, PAYEES_CACHE_FILE, cache);
    return { cache, stats };
}
/**
 * Get payees from cache without syncing.
 * Returns undefined if no cache exists.
 */
export function getPayeesFromCache(budgetId) {
    return readCache(budgetId, PAYEES_CACHE_FILE);
}
/**
 * Get active (non-deleted) payees from cache.
 */
export function getActivePayees(cache) {
    return cache.payees.filter((p) => !p.deleted);
}
/**
 * Search payees by name (case-insensitive partial match).
 */
export function searchPayeesInCache(cache, query) {
    const searchLower = query.toLowerCase();
    return cache.payees
        .filter((p) => !p.deleted)
        .filter((p) => p.name.toLowerCase().includes(searchLower));
}
/**
 * Find a payee by ID in cache.
 */
export function findPayeeById(cache, payeeId) {
    return cache.payees.find((p) => p.id === payeeId);
}
