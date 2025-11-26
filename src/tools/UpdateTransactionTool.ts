import { z } from "zod";
import * as ynab from "ynab";

const subtransactionSchema = z.object({
  amount: z.number().describe("Subtransaction amount in dollars (negative for outflow, positive for inflow)"),
  categoryId: z.string().optional().describe("Category ID for this split"),
  payeeId: z.string().optional().describe("Payee ID (optional, can differ from parent)"),
  payeeName: z.string().optional().describe("Payee name (optional, can differ from parent)"),
  memo: z.string().optional().describe("Memo for this split (optional)"),
});

export const name = "update_transaction";
export const description = "Updates an existing transaction in your YNAB budget. You can update any combination of fields including category, payee, memo, amount, date, cleared status, approved status, and flag color. You can also convert a non-split transaction to a split by providing subtransactions. Note: Once a transaction is a split, its subtransactions cannot be modified via the API.";
export const inputSchema = {
  budgetId: z.string().optional().describe("The id of the budget containing the transaction (optional, defaults to the budget set in the YNAB_BUDGET_ID environment variable)"),
  transactionId: z.string().describe("The id of the transaction to update"),
  accountId: z.string().optional().describe("The id of the account to move the transaction to (optional)"),
  date: z.string().optional().describe("The new date of the transaction in ISO format (e.g. 2024-03-24) (optional)"),
  amount: z.number().optional().describe("The new amount in dollars (e.g. -50.99 for an outflow, 100.00 for an inflow) (optional)"),
  payeeId: z.string().optional().describe("The id of the new payee (optional)"),
  payeeName: z.string().optional().describe("The name of the new payee - will create a new payee if it doesn't exist (optional)"),
  categoryId: z.string().optional().describe("The new category id for the transaction (optional, cannot be set if converting to split)"),
  memo: z.string().optional().describe("The new memo/note for the transaction (optional)"),
  cleared: z.boolean().optional().describe("Whether the transaction should be marked as cleared (optional)"),
  approved: z.boolean().optional().describe("Whether the transaction should be marked as approved (optional)"),
  flagColor: z.string().nullable().optional().describe("The flag color (red, orange, yellow, green, blue, purple) or null to remove the flag (optional)"),
  subtransactions: z.array(subtransactionSchema).optional().describe("Convert a non-split transaction to a split by providing subtransactions. Amounts must sum to the transaction total. Once a transaction is a split, subtransactions cannot be modified via API."),
};

interface SubtransactionInput {
  amount: number;
  categoryId?: string;
  payeeId?: string;
  payeeName?: string;
  memo?: string;
}

interface UpdateTransactionInput {
  budgetId?: string;
  transactionId: string;
  accountId?: string;
  date?: string;
  amount?: number;
  payeeId?: string;
  payeeName?: string;
  categoryId?: string;
  memo?: string;
  cleared?: boolean;
  approved?: boolean;
  flagColor?: string | null;
  subtransactions?: SubtransactionInput[];
}

function getBudgetId(inputBudgetId?: string): string {
  const budgetId = inputBudgetId || process.env.YNAB_BUDGET_ID || "";
  if (!budgetId) {
    throw new Error("No budget ID provided. Please provide a budget ID or set the YNAB_BUDGET_ID environment variable.");
  }
  return budgetId;
}

export async function execute(input: UpdateTransactionInput, api: ynab.API) {
  try {
    const budgetId = getBudgetId(input.budgetId);

    // Check if at least one field to update is provided
    const hasUpdates =
      input.accountId !== undefined ||
      input.date !== undefined ||
      input.amount !== undefined ||
      input.payeeId !== undefined ||
      input.payeeName !== undefined ||
      input.categoryId !== undefined ||
      input.memo !== undefined ||
      input.cleared !== undefined ||
      input.approved !== undefined ||
      input.flagColor !== undefined ||
      input.subtransactions !== undefined;

    if (!hasUpdates) {
      throw new Error("No fields to update. Please provide at least one field to update.");
    }

    // Validate split transaction constraints
    const isConvertingToSplit = input.subtransactions && input.subtransactions.length > 0;
    if (isConvertingToSplit) {
      if (input.categoryId !== undefined) {
        throw new Error("categoryId cannot be set when converting to a split transaction. Categories are specified on each subtransaction.");
      }
      if (input.subtransactions!.length < 2) {
        throw new Error("Split transactions must have at least 2 subtransactions.");
      }
    }

    // Build the update object with only provided fields
    const transactionUpdate: ynab.ExistingTransaction = {};

    if (input.accountId !== undefined) {
      transactionUpdate.account_id = input.accountId;
    }

    if (input.date !== undefined) {
      transactionUpdate.date = input.date;
    }

    if (input.amount !== undefined) {
      transactionUpdate.amount = Math.round(input.amount * 1000);
    }

    if (input.payeeId !== undefined) {
      transactionUpdate.payee_id = input.payeeId;
    }

    if (input.payeeName !== undefined) {
      transactionUpdate.payee_name = input.payeeName;
    }

    if (input.categoryId !== undefined) {
      transactionUpdate.category_id = input.categoryId;
    }

    if (input.memo !== undefined) {
      transactionUpdate.memo = input.memo;
    }

    if (input.cleared !== undefined) {
      transactionUpdate.cleared = input.cleared
        ? ynab.TransactionClearedStatus.Cleared
        : ynab.TransactionClearedStatus.Uncleared;
    }

    if (input.approved !== undefined) {
      transactionUpdate.approved = input.approved;
    }

    if (input.flagColor !== undefined) {
      transactionUpdate.flag_color = input.flagColor as ynab.TransactionFlagColor | null;
    }

    // Build subtransactions array if converting to split
    if (isConvertingToSplit) {
      transactionUpdate.subtransactions = input.subtransactions!.map((st) => ({
        amount: Math.round(st.amount * 1000),
        category_id: st.categoryId,
        payee_id: st.payeeId,
        payee_name: st.payeeName,
        memo: st.memo,
      }));
    }

    const transaction: ynab.PutTransactionWrapper = {
      transaction: transactionUpdate,
    };

    const response = await api.transactions.updateTransaction(
      budgetId,
      input.transactionId,
      transaction
    );

    if (!response.data.transaction) {
      throw new Error("Failed to update transaction - no transaction data returned");
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        success: true,
        transactionId: response.data.transaction.id,
        message: isConvertingToSplit
          ? `Transaction converted to split with ${input.subtransactions!.length} subtransactions`
          : "Transaction updated successfully",
      }, null, 2) }]
    };
  } catch (error) {
    // Extract error details - YNAB API errors have nested structure
    let errorMessage: string;
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "object" && error !== null) {
      errorMessage = JSON.stringify(error);
    } else {
      errorMessage = "Unknown error occurred";
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        success: false,
        error: errorMessage,
      }, null, 2) }]
    };
  }
}
