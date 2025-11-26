import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as ynab from "ynab";
import * as GetPayeeTool from "../tools/GetPayeeTool";

vi.mock("ynab");

describe("GetPayeeTool", () => {
  let mockApi: {
    payees: {
      getPayees: Mock;
    };
  };

  const testBudgetId = "test-get-payee-budget";
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
      {
        id: "payee-1",
        name: "Amazon",
        deleted: false,
        transfer_account_id: null,
      },
      {
        id: "payee-2",
        name: "Grocery Store",
        deleted: false,
        transfer_account_id: null,
      },
      {
        id: "payee-transfer",
        name: "Transfer: Savings",
        deleted: false,
        transfer_account_id: "account-savings-123",
      },
      {
        id: "payee-deleted",
        name: "Old Store",
        deleted: true,
        transfer_account_id: null,
      },
    ];

    it("should successfully get a payee by ID", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await GetPayeeTool.execute({ payeeId: "payee-1" }, mockApi as any);

      expect(mockApi.payees.getPayees).toHaveBeenCalledWith(testBudgetId, undefined);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe("payee-1");
      expect(parsed.name).toBe("Amazon");
      expect(parsed.deleted).toBe(false);
      expect(parsed.transfer_account_id).toBeNull();
    });

    it("should use custom budget ID when provided", async () => {
      const customBudgetId = "custom-budget-id";
      const customCacheDir = path.join(os.homedir(), ".ynab-mcp", "cache", customBudgetId);

      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      await GetPayeeTool.execute({ payeeId: "payee-1", budgetId: customBudgetId }, mockApi as any);

      expect(mockApi.payees.getPayees).toHaveBeenCalledWith(customBudgetId, undefined);

      // Clean up custom cache
      if (fs.existsSync(customCacheDir)) {
        fs.rmSync(customCacheDir, { recursive: true });
      }
    });

    it("should include transfer_account_id for transfer payees", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await GetPayeeTool.execute({ payeeId: "payee-transfer" }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transfer_account_id).toBe("account-savings-123");
    });

    it("should return error when no budget ID is available", async () => {
      delete process.env.YNAB_BUDGET_ID;

      const result = await GetPayeeTool.execute({ payeeId: "payee-1" }, mockApi as any);

      expect(result.content[0].text).toContain("Error getting payee:");
      expect(result.content[0].text).toContain("No budget ID provided");
      expect(mockApi.payees.getPayees).not.toHaveBeenCalled();
    });

    it("should return error when no payee ID is provided", async () => {
      const result = await GetPayeeTool.execute({ payeeId: "" }, mockApi as any);

      expect(result.content[0].text).toContain("Error getting payee:");
      expect(result.content[0].text).toContain("Payee ID is required");
      expect(mockApi.payees.getPayees).not.toHaveBeenCalled();
    });

    it("should handle API error", async () => {
      const apiError = new Error("API Error: Unauthorized");
      mockApi.payees.getPayees.mockRejectedValue(apiError);

      const result = await GetPayeeTool.execute({ payeeId: "payee-1" }, mockApi as any);

      expect(result.content[0].text).toContain("Error getting payee:");
      expect(result.content[0].text).toContain("Unauthorized");
    });

    it("should return message for deleted payee", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await GetPayeeTool.execute({ payeeId: "payee-deleted" }, mockApi as any);

      expect(result.content[0].text).toContain("has been deleted");
      expect(result.content[0].text).toContain("Old Store");
    });

    it("should return error message for non-existent payee", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await GetPayeeTool.execute({ payeeId: "nonexistent-id" }, mockApi as any);

      expect(result.content[0].text).toContain("Payee not found");
      expect(result.content[0].text).toContain("nonexistent-id");
    });

    it("should perform delta sync on subsequent calls", async () => {
      // First call - full sync
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });
      await GetPayeeTool.execute({ payeeId: "payee-1" }, mockApi as any);

      // Second call - delta sync
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: [], server_knowledge: 12345 },
      });
      await GetPayeeTool.execute({ payeeId: "payee-1" }, mockApi as any);

      expect(mockApi.payees.getPayees).toHaveBeenLastCalledWith(testBudgetId, 12345);
    });
  });

  describe("tool configuration", () => {
    it("should have correct name", () => {
      expect(GetPayeeTool.name).toBe("get_payee");
    });

    it("should have correct description", () => {
      expect(GetPayeeTool.description).toContain("payee");
      expect(GetPayeeTool.description).toContain("ID");
    });

    it("should have required payeeId in schema", () => {
      expect(GetPayeeTool.inputSchema.payeeId).toBeDefined();
    });

    it("should have optional budgetId in schema", () => {
      expect(GetPayeeTool.inputSchema.budgetId).toBeDefined();
    });
  });
});
