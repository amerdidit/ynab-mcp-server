import { z } from "zod";
import { syncPayees, findPayeeById, getPayeesFromCache } from "../cache/payees.js";
export const name = "rename_payee";
export const description = "Renames a payee in YNAB. Takes a payee ID and new name. Updates both YNAB and the local cache.";
export const inputSchema = {
    payeeId: z.string().describe("The ID of the payee to rename"),
    newName: z
        .string()
        .max(500)
        .describe("The new name for the payee (max 500 characters)"),
    budgetId: z
        .string()
        .optional()
        .describe("Budget ID (optional, defaults to YNAB_BUDGET_ID env var)"),
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
        const { payeeId, newName } = input;
        if (!payeeId) {
            throw new Error("Payee ID is required.");
        }
        if (!newName || newName.trim() === "") {
            throw new Error("New name is required and cannot be empty.");
        }
        if (newName.length > 500) {
            throw new Error("New name cannot exceed 500 characters.");
        }
        console.log(`Renaming payee ${payeeId} to "${newName}" in budget ${budgetId}`);
        // Check if payee exists in cache first (to get old name for response)
        const cache = getPayeesFromCache(budgetId);
        const existingPayee = cache ? findPayeeById(cache, payeeId) : undefined;
        const oldName = existingPayee?.name;
        if (existingPayee?.deleted) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Cannot rename payee: ${payeeId} (${oldName}) has been deleted.`,
                    },
                ],
            };
        }
        // Update payee via API
        const response = await api.payees.updatePayee(budgetId, payeeId, {
            payee: { name: newName.trim() },
        });
        const updatedPayee = response.data.payee;
        // Sync cache to pick up the change
        await syncPayees(budgetId, api);
        const result = {
            id: updatedPayee.id,
            old_name: oldName || "(unknown)",
            new_name: updatedPayee.name,
            renamed: true,
        };
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
    }
    catch (error) {
        console.error(`Error renaming payee: ${JSON.stringify(error)}`);
        return {
            content: [
                {
                    type: "text",
                    text: `Error renaming payee: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
                },
            ],
        };
    }
}
