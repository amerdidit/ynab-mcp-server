import { z } from "zod";
import { syncPayees, getActivePayees } from "../cache/payees.js";
export const name = "list_payees";
export const description = "Lists all payees in a YNAB budget with pagination. Useful for browsing payees, finding duplicates, or exploring the full payee list. Payees are sorted alphabetically by name. Use search_payees for filtering by name.";
export const inputSchema = {
    page: z
        .number()
        .optional()
        .describe("Page number (1-indexed, default: 1)"),
    pageSize: z
        .number()
        .optional()
        .describe("Number of payees per page (default: 50, max: 200)"),
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
        const page = Math.max(1, input.page ?? 1);
        const pageSize = Math.min(200, Math.max(1, input.pageSize ?? 50));
        console.log(`Listing payees for budget ${budgetId} (page ${page}, size ${pageSize})`);
        // Delta sync first to ensure fresh data
        const { cache } = await syncPayees(budgetId, api);
        // Get active payees and sort alphabetically
        const allPayees = getActivePayees(cache).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
        const totalCount = allPayees.length;
        const totalPages = Math.ceil(totalCount / pageSize);
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const payeesPage = allPayees.slice(startIndex, endIndex).map((payee) => ({
            id: payee.id,
            name: payee.name,
            transfer_account_id: payee.transfer_account_id,
        }));
        console.log(`Returning ${payeesPage.length} payees (page ${page} of ${totalPages})`);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        payees: payeesPage,
                        pagination: {
                            page,
                            page_size: pageSize,
                            total_count: totalCount,
                            total_pages: totalPages,
                            has_more: page < totalPages,
                        },
                    }, null, 2),
                },
            ],
        };
    }
    catch (error) {
        console.error(`Error listing payees: ${JSON.stringify(error)}`);
        return {
            content: [
                {
                    type: "text",
                    text: `Error listing payees: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
                },
            ],
        };
    }
}
