import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as ynab from "ynab";
import * as ListPayeesTool from "../tools/ListPayeesTool";

vi.mock("ynab");

describe("ListPayeesTool", () => {
  let mockApi: {
    payees: {
      getPayees: Mock;
    };
  };

  const testBudgetId = "test-list-payees-budget";
  const testCacheDir = path.join(os.homedir(), ".ynab-mcp", "cache", testBudgetId);

  beforeEach(() => {
    vi.clearAllMocks();

    mockApi = {
      payees: {
        getPayees: vi.fn(),
      },
    };

    (ynab.API as any).mockImplementation(() => mockApi);

    process.env.YNAB_API_TOKEN = "test-token";
    process.env.YNAB_BUDGET_ID = testBudgetId;

    // Clean up cache before each test
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up cache after each test
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true });
    }
  });

  describe("execute", () => {
    const mockPayeesData = [
      { id: "payee-1", name: "Amazon", deleted: false, transfer_account_id: null },
      { id: "payee-2", name: "Best Buy", deleted: false, transfer_account_id: null },
      { id: "payee-3", name: "Costco", deleted: false, transfer_account_id: null },
      { id: "payee-4", name: "Delta Airlines", deleted: false, transfer_account_id: null },
      { id: "payee-5", name: "Electric Company", deleted: false, transfer_account_id: null },
      { id: "payee-deleted", name: "Deleted Store", deleted: true, transfer_account_id: null },
      { id: "payee-transfer", name: "Transfer: Savings", deleted: false, transfer_account_id: "account-123" },
    ];

    it("should list payees sorted alphabetically", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await ListPayeesTool.execute({}, mockApi as any);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.payees.length).toBe(6); // excludes deleted
      expect(parsed.payees[0].name).toBe("Amazon");
      expect(parsed.payees[1].name).toBe("Best Buy");
      expect(parsed.payees[2].name).toBe("Costco");
    });

    it("should paginate results correctly", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await ListPayeesTool.execute({ page: 1, pageSize: 2 }, mockApi as any);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.payees.length).toBe(2);
      expect(parsed.payees[0].name).toBe("Amazon");
      expect(parsed.payees[1].name).toBe("Best Buy");
      expect(parsed.pagination.page).toBe(1);
      expect(parsed.pagination.page_size).toBe(2);
      expect(parsed.pagination.total_count).toBe(6);
      expect(parsed.pagination.total_pages).toBe(3);
      expect(parsed.pagination.has_more).toBe(true);
    });

    it("should return correct second page", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await ListPayeesTool.execute({ page: 2, pageSize: 2 }, mockApi as any);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.payees.length).toBe(2);
      expect(parsed.payees[0].name).toBe("Costco");
      expect(parsed.payees[1].name).toBe("Delta Airlines");
      expect(parsed.pagination.page).toBe(2);
      expect(parsed.pagination.has_more).toBe(true);
    });

    it("should return correct last page", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await ListPayeesTool.execute({ page: 3, pageSize: 2 }, mockApi as any);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.payees.length).toBe(2);
      expect(parsed.payees[0].name).toBe("Electric Company");
      expect(parsed.payees[1].name).toBe("Transfer: Savings");
      expect(parsed.pagination.page).toBe(3);
      expect(parsed.pagination.has_more).toBe(false);
    });

    it("should return empty array for page beyond total", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await ListPayeesTool.execute({ page: 10, pageSize: 2 }, mockApi as any);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.payees.length).toBe(0);
      expect(parsed.pagination.page).toBe(10);
      expect(parsed.pagination.has_more).toBe(false);
    });

    it("should use default page size of 50", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await ListPayeesTool.execute({}, mockApi as any);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.pagination.page_size).toBe(50);
    });

    it("should cap page size at 200", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await ListPayeesTool.execute({ pageSize: 500 }, mockApi as any);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.pagination.page_size).toBe(200);
    });

    it("should handle page size of 0 or negative by using 1", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await ListPayeesTool.execute({ pageSize: 0 }, mockApi as any);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.pagination.page_size).toBe(1);
    });

    it("should handle page 0 or negative by using 1", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await ListPayeesTool.execute({ page: 0 }, mockApi as any);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.pagination.page).toBe(1);
    });

    it("should exclude deleted payees", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await ListPayeesTool.execute({}, mockApi as any);
      const parsed = JSON.parse(result.content[0].text);

      const deletedPayee = parsed.payees.find((p: any) => p.name === "Deleted Store");
      expect(deletedPayee).toBeUndefined();
    });

    it("should include transfer_account_id for transfer payees", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await ListPayeesTool.execute({}, mockApi as any);
      const parsed = JSON.parse(result.content[0].text);

      const transferPayee = parsed.payees.find((p: any) => p.name === "Transfer: Savings");
      expect(transferPayee.transfer_account_id).toBe("account-123");
    });

    it("should use custom budget ID when provided", async () => {
      const customBudgetId = "custom-list-payees-budget";
      const customCacheDir = path.join(os.homedir(), ".ynab-mcp", "cache", customBudgetId);

      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      await ListPayeesTool.execute({ budgetId: customBudgetId }, mockApi as any);

      expect(mockApi.payees.getPayees).toHaveBeenCalledWith(customBudgetId, undefined);

      // Clean up custom cache
      if (fs.existsSync(customCacheDir)) {
        fs.rmSync(customCacheDir, { recursive: true });
      }
    });

    it("should return error when no budget ID is available", async () => {
      delete process.env.YNAB_BUDGET_ID;

      const result = await ListPayeesTool.execute({}, mockApi as any);

      expect(result.content[0].text).toContain("Error listing payees:");
      expect(result.content[0].text).toContain("No budget ID provided");
    });

    it("should handle API error", async () => {
      const apiError = new Error("API Error: Unauthorized");
      mockApi.payees.getPayees.mockRejectedValue(apiError);

      const result = await ListPayeesTool.execute({}, mockApi as any);

      expect(result.content[0].text).toContain("Error listing payees:");
      expect(result.content[0].text).toContain("Unauthorized");
    });

    it("should handle empty payee list", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: [], server_knowledge: 12345 },
      });

      const result = await ListPayeesTool.execute({}, mockApi as any);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.payees.length).toBe(0);
      expect(parsed.pagination.total_count).toBe(0);
      expect(parsed.pagination.total_pages).toBe(0);
      expect(parsed.pagination.has_more).toBe(false);
    });
  });

  describe("tool configuration", () => {
    it("should have correct name", () => {
      expect(ListPayeesTool.name).toBe("list_payees");
    });

    it("should have correct description", () => {
      expect(ListPayeesTool.description).toContain("payees");
      expect(ListPayeesTool.description).toContain("pagination");
    });

    it("should have optional page in schema", () => {
      expect(ListPayeesTool.inputSchema.page).toBeDefined();
    });

    it("should have optional pageSize in schema", () => {
      expect(ListPayeesTool.inputSchema.pageSize).toBeDefined();
    });

    it("should have optional budgetId in schema", () => {
      expect(ListPayeesTool.inputSchema.budgetId).toBeDefined();
    });
  });
});
