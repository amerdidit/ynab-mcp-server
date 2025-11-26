import { z } from "zod";
import { getCategoriesFromCache, searchCategoriesInCache, syncCategories, } from "../cache/categories.js";
export const name = "search_categories";
export const description = "Search for categories by name (case-insensitive partial match). Searches both category names and group names. Requires sync_categories to be run first, or will auto-sync if cache is empty.";
export const inputSchema = {
    budgetId: z
        .string()
        .optional()
        .describe("Budget ID (optional, defaults to YNAB_BUDGET_ID env var)"),
    query: z.string().describe("Search query to match against category or group names"),
};
function getBudgetId(inputBudgetId) {
    const budgetId = inputBudgetId || process.env.YNAB_BUDGET_ID || "";
    if (!budgetId) {
        throw new Error("No budget ID provided. Please provide a budget ID or set the YNAB_BUDGET_ID environment variable.");
    }
    return budgetId;
}
export async function execute(input, api) {
    try {
        const budgetId = getBudgetId(input.budgetId);
        console.log(`Searching categories for "${input.query}" in budget ${budgetId}`);
        // Get cache, auto-sync if empty
        let cache = getCategoriesFromCache(budgetId);
        let autoSynced = false;
        if (!cache) {
            console.log("No cache found, auto-syncing categories...");
            const result = await syncCategories(budgetId, api);
            cache = result.cache;
            autoSynced = true;
        }
        const matches = searchCategoriesInCache(cache, input.query);
        console.log(`Found ${matches.length} matching categories`);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        query: input.query,
                        match_count: matches.length,
                        auto_synced: autoSynced,
                        categories: matches.map((c) => ({
                            id: c.id,
                            name: c.name,
                            group_name: c.category_group_name,
                            budgeted: c.budgeted / 1000,
                            activity: c.activity / 1000,
                            balance: c.balance / 1000,
                            goal_type: c.goal_type,
                            goal_percentage_complete: c.goal_percentage_complete,
                        })),
                    }, null, 2),
                },
            ],
        };
    }
    catch (error) {
        console.error(`Error searching categories: ${JSON.stringify(error)}`);
        return {
            content: [
                {
                    type: "text",
                    text: `Error searching categories: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
                },
            ],
        };
    }
}
