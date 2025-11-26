import { z } from "zod";
export const name = "delete_transaction";
export const description = "Deletes a transaction from your YNAB budget. This action cannot be undone.";
export const inputSchema = {
    budgetId: z.string().optional().describe("The id of the budget containing the transaction (optional, defaults to the budget set in the YNAB_BUDGET_ID environment variable)"),
    transactionId: z.string().describe("The id of the transaction to delete"),
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
        const response = await api.transactions.deleteTransaction(budgetId, input.transactionId);
        if (!response.data.transaction) {
            throw new Error("Failed to delete transaction - no transaction data returned");
        }
        return {
            content: [{ type: "text", text: JSON.stringify({
                        success: true,
                        transactionId: response.data.transaction.id,
                        message: "Transaction deleted successfully",
                    }, null, 2) }]
        };
    }
    catch (error) {
        console.error(`Error deleting transaction for budget ${input.budgetId || process.env.YNAB_BUDGET_ID}:`);
        console.error(JSON.stringify(error, null, 2));
        return {
            content: [{ type: "text", text: `Error deleting transaction: ${error instanceof Error ? error.message : JSON.stringify(error)}` }]
        };
    }
}
