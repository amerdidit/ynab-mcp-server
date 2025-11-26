import { z } from "zod";
import * as ynab from "ynab";
import { syncCategories } from "../cache/categories.js";

export const name = "sync_categories";
export const description =
  "Syncs categories from YNAB to local cache. Returns category count and sync statistics. Use search_categories to find specific categories by name, or get_category to get a single category by ID.";
export const inputSchema = {
  budgetId: z
    .string()
    .optional()
    .describe("Budget ID (optional, defaults to YNAB_BUDGET_ID env var)"),
};

interface SyncCategoriesInput {
  budgetId?: string;
}

function getBudgetId(inputBudgetId?: string): string {
  const budgetId = inputBudgetId || process.env.YNAB_BUDGET_ID || "";
  if (!budgetId) {
    throw new Error(
      "No budget ID provided. Please provide a budget ID or set the YNAB_BUDGET_ID environment variable."
    );
  }
  return budgetId;
}

export async function execute(input: SyncCategoriesInput, api: ynab.API) {
  try {
    const budgetId = getBudgetId(input.budgetId);

    console.log(`Syncing categories for budget ${budgetId}`);
    const { stats } = await syncCategories(budgetId, api);

    console.log(`Synced ${stats.total_categories} categories in ${stats.total_groups} groups`);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              group_count: stats.total_groups,
              category_count: stats.total_categories,
              synced: true,
              changes: {
                groups: {
                  new: stats.new_groups,
                  updated: stats.updated_groups,
                  deleted: stats.deleted_groups,
                },
                categories: {
                  new: stats.new_categories,
                  updated: stats.updated_categories,
                  deleted: stats.deleted_categories,
                },
              },
              hint: "Use search_categories to find specific categories by name, or get_category with an ID",
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: unknown) {
    console.error(`Error syncing categories: ${JSON.stringify(error)}`);
    return {
      content: [
        {
          type: "text" as const,
          text: `Error syncing categories: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        },
      ],
    };
  }
}
