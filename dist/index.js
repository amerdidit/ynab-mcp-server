#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as ynab from "ynab";
// Import all tools
import * as ListBudgetsTool from "./tools/ListBudgetsTool.js";
import * as ListAccountsTool from "./tools/ListAccountsTool.js";
import * as GetAccountTool from "./tools/GetAccountTool.js";
import * as ListCategoriesTool from "./tools/ListCategoriesTool.js";
import * as SyncCategoriesTool from "./tools/SyncCategoriesTool.js";
import * as SearchCategoriesTool from "./tools/SearchCategoriesTool.js";
import * as GetCategoryTool from "./tools/GetCategoryTool.js";
import * as SyncPayeesTool from "./tools/SyncPayeesTool.js";
import * as GetPayeeTool from "./tools/GetPayeeTool.js";
import * as SearchPayeesTool from "./tools/SearchPayeesTool.js";
import * as ListPayeesTool from "./tools/ListPayeesTool.js";
import * as RenamePayeeTool from "./tools/RenamePayeeTool.js";
import * as GetUnapprovedTransactionsTool from "./tools/GetUnapprovedTransactionsTool.js";
import * as BudgetSummaryTool from "./tools/BudgetSummaryTool.js";
import * as CreateTransactionTool from "./tools/CreateTransactionTool.js";
import * as ApproveTransactionTool from "./tools/ApproveTransactionTool.js";
import * as DeleteTransactionTool from "./tools/DeleteTransactionTool.js";
import * as SearchTransactionsTool from "./tools/SearchTransactionsTool.js";
import * as UpdateTransactionTool from "./tools/UpdateTransactionTool.js";
const server = new McpServer({
    name: "ynab-mcp-server",
    version: "0.1.2",
});
// Initialize YNAB API
const api = new ynab.API(process.env.YNAB_API_TOKEN || "");
// Register all tools
server.registerTool(ListBudgetsTool.name, {
    title: "List Budgets",
    description: ListBudgetsTool.description,
    inputSchema: ListBudgetsTool.inputSchema,
}, async (input) => ListBudgetsTool.execute(input, api));
server.registerTool(ListAccountsTool.name, {
    title: "List Accounts",
    description: ListAccountsTool.description,
    inputSchema: ListAccountsTool.inputSchema,
}, async (input) => ListAccountsTool.execute(input, api));
server.registerTool(GetAccountTool.name, {
    title: "Get Account",
    description: GetAccountTool.description,
    inputSchema: GetAccountTool.inputSchema,
}, async (input) => GetAccountTool.execute(input, api));
server.registerTool(ListCategoriesTool.name, {
    title: "List Categories",
    description: ListCategoriesTool.description,
    inputSchema: ListCategoriesTool.inputSchema,
}, async (input) => ListCategoriesTool.execute(input, api));
server.registerTool(SyncCategoriesTool.name, {
    title: "Sync Categories",
    description: SyncCategoriesTool.description,
    inputSchema: SyncCategoriesTool.inputSchema,
}, async (input) => SyncCategoriesTool.execute(input, api));
server.registerTool(SearchCategoriesTool.name, {
    title: "Search Categories",
    description: SearchCategoriesTool.description,
    inputSchema: SearchCategoriesTool.inputSchema,
}, async (input) => SearchCategoriesTool.execute(input, api));
server.registerTool(GetCategoryTool.name, {
    title: "Get Category",
    description: GetCategoryTool.description,
    inputSchema: GetCategoryTool.inputSchema,
}, async (input) => GetCategoryTool.execute(input, api));
server.registerTool(SyncPayeesTool.name, {
    title: "Sync Payees",
    description: SyncPayeesTool.description,
    inputSchema: SyncPayeesTool.inputSchema,
}, async (input) => SyncPayeesTool.execute(input, api));
server.registerTool(GetPayeeTool.name, {
    title: "Get Payee",
    description: GetPayeeTool.description,
    inputSchema: GetPayeeTool.inputSchema,
}, async (input) => GetPayeeTool.execute(input, api));
server.registerTool(SearchPayeesTool.name, {
    title: "Search Payees",
    description: SearchPayeesTool.description,
    inputSchema: SearchPayeesTool.inputSchema,
}, async (input) => SearchPayeesTool.execute(input, api));
server.registerTool(ListPayeesTool.name, {
    title: "List Payees",
    description: ListPayeesTool.description,
    inputSchema: ListPayeesTool.inputSchema,
}, async (input) => ListPayeesTool.execute(input, api));
server.registerTool(RenamePayeeTool.name, {
    title: "Rename Payee",
    description: RenamePayeeTool.description,
    inputSchema: RenamePayeeTool.inputSchema,
}, async (input) => RenamePayeeTool.execute(input, api));
server.registerTool(GetUnapprovedTransactionsTool.name, {
    title: "Get Unapproved Transactions",
    description: GetUnapprovedTransactionsTool.description,
    inputSchema: GetUnapprovedTransactionsTool.inputSchema,
}, async (input) => GetUnapprovedTransactionsTool.execute(input, api));
server.registerTool(BudgetSummaryTool.name, {
    title: "Budget Summary",
    description: BudgetSummaryTool.description,
    inputSchema: BudgetSummaryTool.inputSchema,
}, async (input) => BudgetSummaryTool.execute(input, api));
server.registerTool(CreateTransactionTool.name, {
    title: "Create Transaction",
    description: CreateTransactionTool.description,
    inputSchema: CreateTransactionTool.inputSchema,
}, async (input) => CreateTransactionTool.execute(input, api));
server.registerTool(ApproveTransactionTool.name, {
    title: "Approve Transaction",
    description: ApproveTransactionTool.description,
    inputSchema: ApproveTransactionTool.inputSchema,
}, async (input) => ApproveTransactionTool.execute(input, api));
server.registerTool(DeleteTransactionTool.name, {
    title: "Delete Transaction",
    description: DeleteTransactionTool.description,
    inputSchema: DeleteTransactionTool.inputSchema,
}, async (input) => DeleteTransactionTool.execute(input, api));
server.registerTool(SearchTransactionsTool.name, {
    title: "Search Transactions",
    description: SearchTransactionsTool.description,
    inputSchema: SearchTransactionsTool.inputSchema,
}, async (input) => SearchTransactionsTool.execute(input, api));
server.registerTool(UpdateTransactionTool.name, {
    title: "Update Transaction",
    description: UpdateTransactionTool.description,
    inputSchema: UpdateTransactionTool.inputSchema,
}, async (input) => UpdateTransactionTool.execute(input, api));
// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("YNAB MCP server running on stdio");
}
main().catch(console.error);
