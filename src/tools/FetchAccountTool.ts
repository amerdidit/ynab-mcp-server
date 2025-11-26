import { z } from "zod";
import * as ynab from "ynab";

export const name = "fetch_account";
export const description = "Fetches a single account by ID from a YNAB budget with detailed information including balance, type, and status.";
export const inputSchema = {
  accountId: z.string().describe("The ID of the account to fetch"),
  budgetId: z.string().optional().describe("Budget ID (optional, defaults to YNAB_BUDGET_ID env var)"),
};

interface FetchAccountInput {
  accountId: string;
  budgetId?: string;
}

function getBudgetId(inputBudgetId?: string): string {
  const budgetId = inputBudgetId || process.env.YNAB_BUDGET_ID || "";
  if (!budgetId) {
    throw new Error("No budget ID provided. Please provide a budget ID or set the YNAB_BUDGET_ID environment variable.");
  }
  return budgetId;
}

export async function execute(input: FetchAccountInput, api: ynab.API) {
  try {
    const budgetId = getBudgetId(input.budgetId);
    const accountId = input.accountId;

    if (!accountId) {
      throw new Error("Account ID is required.");
    }

    console.log(`Fetching account ${accountId} for budget ${budgetId}`);
    const accountResponse = await api.accounts.getAccountById(budgetId, accountId);
    const account = accountResponse.data.account;

    const result = {
      id: account.id,
      name: account.name,
      type: account.type,
      on_budget: account.on_budget,
      closed: account.closed,
      deleted: account.deleted,
      balance: account.balance / 1000,
      cleared_balance: account.cleared_balance / 1000,
      uncleared_balance: account.uncleared_balance / 1000,
      transfer_payee_id: account.transfer_payee_id,
      direct_import_linked: account.direct_import_linked,
      direct_import_in_error: account.direct_import_in_error,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }]
    };
  } catch (error: unknown) {
    console.error(`Error fetching account: ${JSON.stringify(error)}`);
    return {
      content: [{ type: "text" as const, text: `Error fetching account: ${error instanceof Error ? error.message : JSON.stringify(error)}` }]
    };
  }
}
