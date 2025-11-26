import { readCache, writeCache } from "./index.js";
const CATEGORIES_CACHE_FILE = "categories.json";
/**
 * Sync categories from YNAB API to local cache using delta sync.
 * If cache exists, only fetches changes since last sync.
 * Returns the updated cache and sync statistics.
 */
export async function syncCategories(budgetId, api) {
    const existing = readCache(budgetId, CATEGORIES_CACHE_FILE);
    // Fetch from API (delta if we have server_knowledge)
    const response = await api.categories.getCategories(budgetId, existing?.server_knowledge);
    const stats = {
        total_groups: 0,
        total_categories: 0,
        new_groups: 0,
        updated_groups: 0,
        deleted_groups: 0,
        new_categories: 0,
        updated_categories: 0,
        deleted_categories: 0,
    };
    let cache;
    if (existing) {
        // Merge delta into existing cache
        cache = { ...existing };
        for (const group of response.data.category_groups) {
            const groupIdx = cache.category_groups.findIndex((g) => g.id === group.id);
            if (groupIdx >= 0) {
                // Existing group - check if deleted or updated
                if (group.deleted && !cache.category_groups[groupIdx].deleted) {
                    stats.deleted_groups++;
                }
                else if (!group.deleted) {
                    stats.updated_groups++;
                }
                cache.category_groups[groupIdx] = {
                    id: group.id,
                    name: group.name,
                    hidden: group.hidden,
                    deleted: group.deleted,
                };
            }
            else {
                // New group
                stats.new_groups++;
                cache.category_groups.push({
                    id: group.id,
                    name: group.name,
                    hidden: group.hidden,
                    deleted: group.deleted,
                });
            }
            // Process categories within this group
            for (const category of group.categories) {
                const catIdx = cache.categories.findIndex((c) => c.id === category.id);
                const cachedCategory = {
                    id: category.id,
                    name: category.name,
                    category_group_id: category.category_group_id,
                    category_group_name: group.name,
                    hidden: category.hidden,
                    deleted: category.deleted,
                    note: category.note || null,
                    budgeted: category.budgeted,
                    activity: category.activity,
                    balance: category.balance,
                    goal_type: category.goal_type || null,
                    goal_percentage_complete: category.goal_percentage_complete || null,
                };
                if (catIdx >= 0) {
                    // Existing category
                    if (category.deleted && !cache.categories[catIdx].deleted) {
                        stats.deleted_categories++;
                    }
                    else if (!category.deleted) {
                        stats.updated_categories++;
                    }
                    cache.categories[catIdx] = cachedCategory;
                }
                else {
                    // New category
                    stats.new_categories++;
                    cache.categories.push(cachedCategory);
                }
            }
        }
        cache.server_knowledge = response.data.server_knowledge;
        cache.last_synced = new Date().toISOString();
    }
    else {
        // Fresh cache (first sync)
        const categoryGroups = [];
        const categories = [];
        for (const group of response.data.category_groups) {
            categoryGroups.push({
                id: group.id,
                name: group.name,
                hidden: group.hidden,
                deleted: group.deleted,
            });
            for (const category of group.categories) {
                categories.push({
                    id: category.id,
                    name: category.name,
                    category_group_id: category.category_group_id,
                    category_group_name: group.name,
                    hidden: category.hidden,
                    deleted: category.deleted,
                    note: category.note || null,
                    budgeted: category.budgeted,
                    activity: category.activity,
                    balance: category.balance,
                    goal_type: category.goal_type || null,
                    goal_percentage_complete: category.goal_percentage_complete || null,
                });
            }
        }
        cache = {
            server_knowledge: response.data.server_knowledge,
            last_synced: new Date().toISOString(),
            category_groups: categoryGroups,
            categories: categories,
        };
        stats.new_groups = categoryGroups.filter((g) => !g.deleted).length;
        stats.new_categories = categories.filter((c) => !c.deleted).length;
    }
    stats.total_groups = cache.category_groups.filter((g) => !g.deleted && !g.hidden).length;
    stats.total_categories = cache.categories.filter((c) => !c.deleted && !c.hidden).length;
    writeCache(budgetId, CATEGORIES_CACHE_FILE, cache);
    return { cache, stats };
}
/**
 * Get categories from cache without syncing.
 * Returns undefined if no cache exists.
 */
export function getCategoriesFromCache(budgetId) {
    return readCache(budgetId, CATEGORIES_CACHE_FILE);
}
/**
 * Get active (non-deleted, non-hidden) categories from cache.
 */
export function getActiveCategories(cache) {
    return cache.categories.filter((c) => !c.deleted && !c.hidden);
}
/**
 * Get active (non-deleted, non-hidden) category groups from cache.
 */
export function getActiveCategoryGroups(cache) {
    return cache.category_groups.filter((g) => !g.deleted && !g.hidden);
}
/**
 * Search categories by name (case-insensitive partial match).
 */
export function searchCategoriesInCache(cache, query) {
    const searchLower = query.toLowerCase();
    return cache.categories
        .filter((c) => !c.deleted && !c.hidden)
        .filter((c) => c.name.toLowerCase().includes(searchLower) ||
        c.category_group_name.toLowerCase().includes(searchLower));
}
/**
 * Find a category by ID in cache.
 */
export function findCategoryById(cache, categoryId) {
    return cache.categories.find((c) => c.id === categoryId);
}
/**
 * Get categories organized by group (for display purposes).
 */
export function getCategoriesByGroup(cache) {
    const activeGroups = getActiveCategoryGroups(cache);
    const activeCategories = getActiveCategories(cache);
    return activeGroups.map((group) => ({
        group,
        categories: activeCategories.filter((c) => c.category_group_id === group.id),
    }));
}
