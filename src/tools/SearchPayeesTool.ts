import { z } from "zod";
import * as ynab from "ynab";
import { syncPayees, searchPayeesInCache } from "../cache/payees.js";

export const name = "search_payees";
export const description =
  "Searches payees by name in a YNAB budget. Syncs payees first to ensure fresh data, then searches locally. Search is case-insensitive partial match. Use this to find payees matching a search term.";
export const inputSchema = {
  query: z
    .string()
    .describe("Search term to match against payee names (case-insensitive)"),
  limit: z
    .number()
    .optional()
    .describe("Maximum number of results to return (default: 50)"),
  budgetId: z
    .string()
    .optional()
    .describe("Budget ID (optional, defaults to YNAB_BUDGET_ID env var)"),
};

interface SearchPayeesInput {
  query: string;
  limit?: number;
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

export async function execute(input: SearchPayeesInput, api: ynab.API) {
  try {
    const budgetId = getBudgetId(input.budgetId);
    const query = input.query;
    const limit = input.limit ?? 50;

    if (!query) {
      throw new Error("Search query is required.");
    }

    console.log(`Searching payees for "${query}" in budget ${budgetId}`);

    // Delta sync first to ensure fresh data
    const { cache } = await syncPayees(budgetId, api);

    // Search locally
    const allMatches = searchPayeesInCache(cache, query);
    const matchingPayees = allMatches.slice(0, limit).map((payee) => ({
      id: payee.id,
      name: payee.name,
      transfer_account_id: payee.transfer_account_id,
    }));

    console.log(`Found ${allMatches.length} payees matching "${query}"`);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              query,
              payees: matchingPayees,
              match_count: allMatches.length,
              showing: matchingPayees.length,
              truncated: allMatches.length > limit,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: unknown) {
    console.error(`Error searching payees: ${JSON.stringify(error)}`);
    return {
      content: [
        {
          type: "text" as const,
          text: `Error searching payees: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        },
      ],
    };
  }
}
