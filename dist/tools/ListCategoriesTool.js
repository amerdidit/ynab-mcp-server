import { z } from "zod";
export const name = "list_categories";
export const description = "Lists all categories from a YNAB budget organized by category group. Returns category IDs, names, and current month budget amounts. Use this to get category IDs needed for categorizing transactions.";
export const inputSchema = {
    budgetId: z.string().optional().describe("Budget ID (optional, defaults to YNAB_BUDGET_ID env var)"),
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
        console.log(`Listing categories for budget ${budgetId}`);
        const categoriesResponse = await api.categories.getCategories(budgetId);
        const categoryGroups = categoriesResponse.data.category_groups
            .filter((group) => group.deleted === false && group.hidden === false)
            .map((group) => ({
            id: group.id,
            name: group.name,
            categories: group.categories
                .filter((category) => category.deleted === false && category.hidden === false)
                .map((category) => ({
                id: category.id,
                name: category.name,
                budgeted: category.budgeted / 1000,
                activity: category.activity / 1000,
                balance: category.balance / 1000,
                goal_type: category.goal_type || null,
                goal_percentage_complete: category.goal_percentage_complete || null,
            })),
        }));
        const totalCategories = categoryGroups.reduce((sum, group) => sum + group.categories.length, 0);
        console.log(`Found ${categoryGroups.length} category groups with ${totalCategories} categories`);
        return {
            content: [{ type: "text", text: JSON.stringify({
                        category_groups: categoryGroups,
                        group_count: categoryGroups.length,
                        category_count: totalCategories,
                    }, null, 2) }]
        };
    }
    catch (error) {
        console.error(`Error listing categories: ${JSON.stringify(error)}`);
        return {
            content: [{ type: "text", text: `Error listing categories: ${error instanceof Error ? error.message : JSON.stringify(error)}` }]
        };
    }
}
