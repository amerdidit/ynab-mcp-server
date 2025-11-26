import { z } from "zod";
import * as ynab from "ynab";
import {
  getCategoriesFromCache,
  findCategoryById,
  syncCategories,
} from "../cache/categories.js";

export const name = "get_category";
export const description =
  "Get a single category by ID from the local cache. Returns category details including budget amounts. Requires sync_categories to be run first, or will auto-sync if cache is empty.";
export const inputSchema = {
  budgetId: z
    .string()
    .optional()
    .describe("Budget ID (optional, defaults to YNAB_BUDGET_ID env var)"),
  categoryId: z.string().describe("The ID of the category to retrieve"),
};

interface GetCategoryInput {
  budgetId?: string;
  categoryId: string;
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

export async function execute(input: GetCategoryInput, api: ynab.API) {
  try {
    const budgetId = getBudgetId(input.budgetId);

    console.log(`Getting category ${input.categoryId} from budget ${budgetId}`);

    // Get cache, auto-sync if empty
    let cache = getCategoriesFromCache(budgetId);
    let autoSynced = false;

    if (!cache) {
      console.log("No cache found, auto-syncing categories...");
      const result = await syncCategories(budgetId, api);
      cache = result.cache;
      autoSynced = true;
    }

    const category = findCategoryById(cache, input.categoryId);

    if (!category) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                error: "Category not found",
                category_id: input.categoryId,
                auto_synced: autoSynced,
                hint: "Use search_categories to find categories by name, or sync_categories to refresh the cache",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    console.log(`Found category: ${category.name}`);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              auto_synced: autoSynced,
              category: {
                id: category.id,
                name: category.name,
                group_name: category.category_group_name,
                note: category.note,
                budgeted: category.budgeted / 1000,
                activity: category.activity / 1000,
                balance: category.balance / 1000,
                goal_type: category.goal_type,
                goal_percentage_complete: category.goal_percentage_complete,
                hidden: category.hidden,
                deleted: category.deleted,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: unknown) {
    console.error(`Error getting category: ${JSON.stringify(error)}`);
    return {
      content: [
        {
          type: "text" as const,
          text: `Error getting category: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        },
      ],
    };
  }
}
