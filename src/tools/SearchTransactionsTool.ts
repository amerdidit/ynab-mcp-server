import { z } from "zod";
import * as ynab from "ynab";

export const name = "search_transactions";
export const description = `Search and filter transactions with flexible criteria.

**Required:** sinceDate - start date (inclusive)

**Optional filters:** beforeDate (exclusive), accountId, categoryId, payeeId, amount range, text search (memo, payeeName), status (cleared, approved), flagColor

**Amount examples:**
- Outflows $20-$100: minAmount: -100, maxAmount: -20
- Inflows $50-$200: minAmount: 50, maxAmount: 200
- All outflows: maxAmount: 0
- All inflows: minAmount: 0

**Response includes:** transactions[] (amounts in dollars), transaction_count (after limit), total_matching (before limit), filters_applied`;

export const inputSchema = {
  budgetId: z.string().optional().describe("Budget ID (defaults to YNAB_BUDGET_ID env var)"),
  sinceDate: z.string().describe("Start date, inclusive (ISO format: '2024-01-01')"),
  beforeDate: z.string().optional().describe("End date, exclusive (ISO format: '2024-02-01')"),
  accountId: z.string().optional().describe("Filter by account ID"),
  categoryId: z.string().optional().describe("Filter by category ID, or use \"uncategorized\" to find transactions without a category. For split transactions, returns the parent transaction if any subtransaction matches."),
  payeeId: z.string().optional().describe("Filter by payee ID"),
  minAmount: z.number().optional().describe("Min amount in dollars (inclusive). Outflows are negative, inflows positive. Example: -100 for outflows of $100 or less."),
  maxAmount: z.number().optional().describe("Max amount in dollars (inclusive). Outflows are negative, inflows positive. Example: -20 for outflows of $20 or more."),
  memo: z.string().optional().describe("Case-insensitive partial text match in memo"),
  payeeName: z.string().optional().describe("Case-insensitive partial text match in payee name"),
  cleared: z.enum(["cleared", "uncleared", "reconciled"]).optional().describe("Filter by cleared status"),
  approved: z.boolean().optional().describe("Filter by approval status (true=approved, false=unapproved)"),
  flagColor: z.enum(["red", "orange", "yellow", "green", "blue", "purple"]).optional().describe("Filter by flag color"),
  excludeBudgetTransfers: z.boolean().optional().describe("Exclude transfers between on-budget accounts (default: false). These don't need categories since money just moves between accounts. Transfers to/from tracking accounts are kept since they represent real income/expenses."),
  limit: z.number().optional().describe("Max transactions to return (default: 100)"),
};

interface SearchTransactionsInput {
  budgetId?: string;
  sinceDate: string;
  beforeDate?: string;
  accountId?: string;
  categoryId?: string;
  payeeId?: string;
  minAmount?: number;
  maxAmount?: number;
  memo?: string;
  payeeName?: string;
  cleared?: "cleared" | "uncleared" | "reconciled";
  approved?: boolean;
  flagColor?: "red" | "orange" | "yellow" | "green" | "blue" | "purple";
  excludeBudgetTransfers?: boolean;
  limit?: number;
}

function getBudgetId(inputBudgetId?: string): string {
  const budgetId = inputBudgetId || process.env.YNAB_BUDGET_ID || "";
  if (!budgetId) {
    throw new Error("No budget ID provided. Please provide a budget ID or set the YNAB_BUDGET_ID environment variable.");
  }
  return budgetId;
}

export async function execute(input: SearchTransactionsInput, api: ynab.API) {
  try {
    const budgetId = getBudgetId(input.budgetId);
    const limit = input.limit ?? 100;

    // Determine if filtering for uncategorized transactions
    const isUncategorizedFilter = input.categoryId?.toLowerCase() === "uncategorized";

    console.log(`Searching transactions for budget ${budgetId} since ${input.sinceDate}`);

    // Fetch transactions from YNAB API
    // Use the API's native type filter for uncategorized transactions
    const response = await api.transactions.getTransactions(
      budgetId,
      input.sinceDate,
      isUncategorizedFilter ? "uncategorized" : undefined
    );

    let transactions = response.data.transactions.filter((t) => !t.deleted);

    // Build account on_budget lookup if needed for transfer filtering
    let accountOnBudgetMap: Map<string, boolean> | null = null;
    if (input.excludeBudgetTransfers) {
      const accountsResponse = await api.accounts.getAccounts(budgetId);
      accountOnBudgetMap = new Map(
        accountsResponse.data.accounts.map((a) => [a.id, a.on_budget])
      );
    }

    // Apply client-side filters

    // beforeDate filter (exclusive)
    if (input.beforeDate) {
      transactions = transactions.filter((t) => t.date < input.beforeDate!);
    }

    // accountId filter
    if (input.accountId) {
      transactions = transactions.filter((t) => t.account_id === input.accountId);
    }

    // categoryId filter (check both main category and subtransactions)
    // Skip if already filtered for uncategorized via API
    if (input.categoryId && !isUncategorizedFilter) {
      transactions = transactions.filter((t) => {
        // Check main category
        if (t.category_id === input.categoryId) return true;
        // Check subtransactions for split transactions
        if (t.subtransactions && t.subtransactions.length > 0) {
          return t.subtransactions.some((st) => st.category_id === input.categoryId);
        }
        return false;
      });
    }

    // payeeId filter
    if (input.payeeId) {
      transactions = transactions.filter((t) => t.payee_id === input.payeeId);
    }

    // minAmount filter (amounts are in milliunits)
    if (input.minAmount !== undefined) {
      const minMilliunits = Math.round(input.minAmount * 1000);
      transactions = transactions.filter((t) => t.amount >= minMilliunits);
    }

    // maxAmount filter (amounts are in milliunits)
    if (input.maxAmount !== undefined) {
      const maxMilliunits = Math.round(input.maxAmount * 1000);
      transactions = transactions.filter((t) => t.amount <= maxMilliunits);
    }

    // memo text search (case-insensitive)
    if (input.memo) {
      const searchMemo = input.memo.toLowerCase();
      transactions = transactions.filter((t) =>
        t.memo && t.memo.toLowerCase().includes(searchMemo)
      );
    }

    // payeeName text search (case-insensitive)
    if (input.payeeName) {
      const searchPayee = input.payeeName.toLowerCase();
      transactions = transactions.filter((t) =>
        t.payee_name && t.payee_name.toLowerCase().includes(searchPayee)
      );
    }

    // cleared status filter
    if (input.cleared) {
      transactions = transactions.filter((t) => t.cleared === input.cleared);
    }

    // approved status filter
    if (input.approved !== undefined) {
      transactions = transactions.filter((t) => t.approved === input.approved);
    }

    // flagColor filter
    if (input.flagColor) {
      transactions = transactions.filter((t) => t.flag_color === input.flagColor);
    }

    // excludeBudgetTransfers filter - exclude transfers where BOTH accounts are on-budget
    if (input.excludeBudgetTransfers && accountOnBudgetMap) {
      transactions = transactions.filter((t) => {
        // Not a transfer - keep it
        if (!t.transfer_account_id) return true;

        // Check if both source and destination are on-budget
        const sourceOnBudget = accountOnBudgetMap!.get(t.account_id) ?? false;
        const destOnBudget = accountOnBudgetMap!.get(t.transfer_account_id) ?? false;

        // Exclude only if BOTH are on-budget (money moving within budget)
        // Keep transfers to/from tracking accounts (they need categories)
        return !(sourceOnBudget && destOnBudget);
      });
    }

    // Apply limit
    const limitedTransactions = transactions.slice(0, limit);

    // Build filters_applied object for response
    const filtersApplied: Record<string, string | number | boolean> = {
      since_date: input.sinceDate,
    };
    if (input.beforeDate) filtersApplied.before_date = input.beforeDate;
    if (input.accountId) filtersApplied.account_id = input.accountId;
    if (input.categoryId) filtersApplied.category_id = input.categoryId;
    if (input.payeeId) filtersApplied.payee_id = input.payeeId;
    if (input.minAmount !== undefined) filtersApplied.min_amount = input.minAmount;
    if (input.maxAmount !== undefined) filtersApplied.max_amount = input.maxAmount;
    if (input.memo) filtersApplied.memo = input.memo;
    if (input.payeeName) filtersApplied.payee_name = input.payeeName;
    if (input.cleared) filtersApplied.cleared = input.cleared;
    if (input.approved !== undefined) filtersApplied.approved = input.approved;
    if (input.flagColor) filtersApplied.flag_color = input.flagColor;
    if (input.excludeBudgetTransfers) filtersApplied.exclude_budget_transfers = input.excludeBudgetTransfers;

    // Transform transactions to response format
    const formattedTransactions = limitedTransactions.map((t) => ({
      id: t.id,
      date: t.date,
      amount: (t.amount / 1000).toFixed(2),
      memo: t.memo,
      approved: t.approved,
      cleared: t.cleared,
      account_id: t.account_id,
      account_name: t.account_name,
      payee_id: t.payee_id,
      payee_name: t.payee_name,
      category_id: t.category_id,
      category_name: t.category_name,
      flag_color: t.flag_color,
      transfer_account_id: t.transfer_account_id,
    }));

    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        transactions: formattedTransactions,
        transaction_count: formattedTransactions.length,
        total_matching: transactions.length,
        filters_applied: filtersApplied,
      }, null, 2) }]
    };
  } catch (error) {
    console.error(`Error searching transactions for budget ${input.budgetId || process.env.YNAB_BUDGET_ID}:`);
    console.error(JSON.stringify(error, null, 2));
    return {
      content: [{ type: "text" as const, text: `Error searching transactions: ${
        error instanceof Error ? error.message : JSON.stringify(error)
      }` }]
    };
  }
}
