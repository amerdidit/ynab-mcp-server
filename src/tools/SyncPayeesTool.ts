import { z } from "zod";
import * as ynab from "ynab";
import { syncPayees } from "../cache/payees.js";

export const name = "sync_payees";
export const description =
  "Syncs payees from YNAB to local cache. Returns payee count and sync statistics. Use search_payees to find specific payees by name, or get_payee to get a single payee by ID.";
export const inputSchema = {
  budgetId: z
    .string()
    .optional()
    .describe("Budget ID (optional, defaults to YNAB_BUDGET_ID env var)"),
};

interface SyncPayeesInput {
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

export async function execute(input: SyncPayeesInput, api: ynab.API) {
  try {
    const budgetId = getBudgetId(input.budgetId);

    console.log(`Syncing payees for budget ${budgetId}`);
    const { stats } = await syncPayees(budgetId, api);

    console.log(`Synced ${stats.total} payees`);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              payee_count: stats.total,
              synced: true,
              changes: {
                new: stats.new,
                updated: stats.updated,
                deleted: stats.deleted,
              },
              hint: "Use search_payees to find specific payees by name, or get_payee with an ID",
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: unknown) {
    console.error(`Error syncing payees: ${JSON.stringify(error)}`);
    return {
      content: [
        {
          type: "text" as const,
          text: `Error syncing payees: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        },
      ],
    };
  }
}
