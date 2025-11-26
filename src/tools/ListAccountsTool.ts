import { z } from "zod";
import * as ynab from "ynab";

export const name = "list_accounts";
export const description = "Lists all accounts from a YNAB budget with their IDs, names, types, and balances. Use this to get account IDs needed for create_transaction.";
export const inputSchema = {
  budgetId: z.string().optional().describe("Budget ID (optional, defaults to YNAB_BUDGET_ID env var)"),
};

interface ListAccountsInput {
  budgetId?: string;
}

function getBudgetId(inputBudgetId?: string): string {
  const budgetId = inputBudgetId || process.env.YNAB_BUDGET_ID || "";
  if (!budgetId) {
    throw new Error("No budget ID provided. Please provide a budget ID or set the YNAB_BUDGET_ID environment variable.");
  }
  return budgetId;
}

export async function execute(input: ListAccountsInput, api: ynab.API) {
  try {
    const budgetId = getBudgetId(input.budgetId);

    console.log(`Listing accounts for budget ${budgetId}`);
    const accountsResponse = await api.accounts.getAccounts(budgetId);

    const accounts = accountsResponse.data.accounts
      .filter((account) => account.deleted === false && account.closed === false)
      .map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        on_budget: account.on_budget,
        balance: account.balance / 1000,
        cleared_balance: account.cleared_balance / 1000,
        uncleared_balance: account.uncleared_balance / 1000,
      }));

    console.log(`Found ${accounts.length} active accounts`);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        accounts,
        account_count: accounts.length,
      }, null, 2) }]
    };
  } catch (error: unknown) {
    console.error(`Error listing accounts: ${JSON.stringify(error)}`);
    return {
      content: [{ type: "text" as const, text: `Error listing accounts: ${error instanceof Error ? error.message : JSON.stringify(error)}` }]
    };
  }
}
