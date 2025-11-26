import { z } from "zod";
import * as ynab from "ynab";
import { syncPayees, findPayeeById } from "../cache/payees.js";

export const name = "get_payee";
export const description =
  "Gets a single payee by ID from a YNAB budget. Syncs payees first to ensure fresh data, then looks up from cache.";
export const inputSchema = {
  payeeId: z.string().describe("The ID of the payee to get"),
  budgetId: z
    .string()
    .optional()
    .describe("Budget ID (optional, defaults to YNAB_BUDGET_ID env var)"),
};

interface GetPayeeInput {
  payeeId: string;
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

export async function execute(input: GetPayeeInput, api: ynab.API) {
  try {
    const budgetId = getBudgetId(input.budgetId);
    const payeeId = input.payeeId;

    if (!payeeId) {
      throw new Error("Payee ID is required.");
    }

    console.log(`Getting payee ${payeeId} for budget ${budgetId}`);

    // Delta sync first to ensure fresh data
    const { cache } = await syncPayees(budgetId, api);

    // Look up payee from cache
    const payee = findPayeeById(cache, payeeId);

    if (!payee) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Payee not found: ${payeeId}. The payee may have been deleted or the ID is incorrect.`,
          },
        ],
      };
    }

    if (payee.deleted) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Payee ${payeeId} (${payee.name}) has been deleted.`,
          },
        ],
      };
    }

    const result = {
      id: payee.id,
      name: payee.name,
      deleted: payee.deleted,
      transfer_account_id: payee.transfer_account_id,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (error: unknown) {
    console.error(`Error getting payee: ${JSON.stringify(error)}`);
    return {
      content: [
        {
          type: "text" as const,
          text: `Error getting payee: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        },
      ],
    };
  }
}
