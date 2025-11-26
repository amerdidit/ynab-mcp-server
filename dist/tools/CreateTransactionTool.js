import { z } from "zod";
import * as ynab from "ynab";
const subtransactionSchema = z.object({
    amount: z.number().describe("Subtransaction amount in dollars (negative for outflow, positive for inflow)"),
    categoryId: z.string().optional().describe("Category ID for this split"),
    payeeId: z.string().optional().describe("Payee ID (optional, can differ from parent)"),
    payeeName: z.string().optional().describe("Payee name (optional, can differ from parent)"),
    memo: z.string().optional().describe("Memo for this split (optional)"),
});
export const name = "create_transaction";
export const description = "Creates a new transaction in your YNAB budget. Either payeeId or payeeName must be provided. For split transactions, provide subtransactions array and omit categoryId.";
export const inputSchema = {
    budgetId: z.string().optional().describe("The id of the budget to create the transaction in (optional, defaults to the budget set in the YNAB_BUDGET_ID environment variable)"),
    accountId: z.string().describe("The id of the account to create the transaction in"),
    date: z.string().describe("The date of the transaction in ISO format (e.g. 2024-03-24)"),
    amount: z.number().describe("The amount in dollars (e.g. -50.99 for outflow, 100.00 for inflow)"),
    payeeId: z.string().optional().describe("The id of the payee (optional if payeeName is provided)"),
    payeeName: z.string().optional().describe("The name of the payee (optional if payeeId is provided)"),
    categoryId: z.string().optional().describe("The category id for the transaction (optional, must be omitted for split transactions)"),
    memo: z.string().optional().describe("A memo/note for the transaction (optional)"),
    cleared: z.boolean().optional().describe("Whether the transaction is cleared (optional, defaults to false)"),
    approved: z.boolean().optional().describe("Whether the transaction is approved (optional, defaults to false)"),
    flagColor: z.string().optional().describe("The transaction flag color (red, orange, yellow, green, blue, purple) (optional)"),
    subtransactions: z.array(subtransactionSchema).optional().describe("For split transactions: array of subtransactions. When provided, categoryId must be omitted. Subtransaction amounts must sum to the total transaction amount."),
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
        if (!input.payeeId && !input.payeeName) {
            throw new Error("Either payeeId or payeeName must be provided");
        }
        // Validate split transaction constraints
        if (input.subtransactions && input.subtransactions.length > 0) {
            if (input.categoryId) {
                throw new Error("categoryId must be omitted for split transactions. Categories are specified on each subtransaction.");
            }
            if (input.subtransactions.length < 2) {
                throw new Error("Split transactions must have at least 2 subtransactions.");
            }
        }
        const milliunitAmount = Math.round(input.amount * 1000);
        // Build subtransactions array if provided
        let subtransactions;
        if (input.subtransactions && input.subtransactions.length > 0) {
            subtransactions = input.subtransactions.map((st) => ({
                amount: Math.round(st.amount * 1000),
                category_id: st.categoryId,
                payee_id: st.payeeId,
                payee_name: st.payeeName,
                memo: st.memo,
            }));
        }
        const transaction = {
            transaction: {
                account_id: input.accountId,
                date: input.date,
                amount: milliunitAmount,
                payee_id: input.payeeId,
                payee_name: input.payeeName,
                category_id: subtransactions ? undefined : input.categoryId,
                memo: input.memo,
                cleared: input.cleared ? ynab.TransactionClearedStatus.Cleared : ynab.TransactionClearedStatus.Uncleared,
                approved: input.approved ?? false,
                flag_color: input.flagColor,
                subtransactions,
            }
        };
        const response = await api.transactions.createTransaction(budgetId, transaction);
        if (!response.data.transaction) {
            throw new Error("Failed to create transaction - no transaction data returned");
        }
        const isSplit = input.subtransactions && input.subtransactions.length > 0;
        return {
            content: [{ type: "text", text: JSON.stringify({
                        success: true,
                        transactionId: response.data.transaction.id,
                        message: isSplit
                            ? `Split transaction created successfully with ${input.subtransactions.length} subtransactions`
                            : "Transaction created successfully",
                    }, null, 2) }]
        };
    }
    catch (error) {
        // Extract error details - YNAB API errors have nested structure
        let errorMessage;
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        else if (typeof error === "object" && error !== null) {
            errorMessage = JSON.stringify(error);
        }
        else {
            errorMessage = "Unknown error occurred";
        }
        return {
            content: [{ type: "text", text: JSON.stringify({
                        success: false,
                        error: errorMessage,
                    }, null, 2) }]
        };
    }
}
