import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as ynab from "ynab";
import * as SyncPayeesTool from "../tools/SyncPayeesTool";

vi.mock("ynab");

describe("SyncPayeesTool", () => {
  let mockApi: {
    payees: {
      getPayees: Mock;
    };
  };

  const testBudgetId = "default-budget-id";
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
        id: "payee-3",
        name: "Transfer: Savings",
        deleted: false,
        transfer_account_id: "account-savings-123",
      },
    ];

    it("should return payee count and sync stats on first sync", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await SyncPayeesTool.execute({}, mockApi as any);

      expect(mockApi.payees.getPayees).toHaveBeenCalledWith(testBudgetId, undefined);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.payee_count).toBe(3);
      expect(parsed.synced).toBe(true);
      expect(parsed.changes.new).toBe(3);
      expect(parsed.changes.updated).toBe(0);
      expect(parsed.changes.deleted).toBe(0);
      expect(parsed.hint).toContain("search_payees");
    });

    it("should filter out deleted payees from count", async () => {
      const dataWithDeleted = [
        ...mockPayeesData,
        {
          id: "payee-deleted",
          name: "Deleted Payee",
          deleted: true,
          transfer_account_id: null,
        },
      ];

      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: dataWithDeleted, server_knowledge: 12345 },
      });

      const result = await SyncPayeesTool.execute({}, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.payee_count).toBe(3);
    });

    it("should use custom budget ID when provided", async () => {
      const customBudgetId = "custom-budget-id";
      const customCacheDir = path.join(os.homedir(), ".ynab-mcp", "cache", customBudgetId);

      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      await SyncPayeesTool.execute({ budgetId: customBudgetId }, mockApi as any);

      expect(mockApi.payees.getPayees).toHaveBeenCalledWith(customBudgetId, undefined);

      // Clean up custom cache
      if (fs.existsSync(customCacheDir)) {
        fs.rmSync(customCacheDir, { recursive: true });
      }
    });

    it("should handle empty payee list", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: [], server_knowledge: 12345 },
      });

      const result = await SyncPayeesTool.execute({}, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.payee_count).toBe(0);
      expect(parsed.changes.new).toBe(0);
    });

    it("should return error when no budget ID is available", async () => {
      delete process.env.YNAB_BUDGET_ID;

      const result = await SyncPayeesTool.execute({}, mockApi as any);

      expect(result.content[0].text).toContain("Error syncing payees:");
      expect(result.content[0].text).toContain("No budget ID provided");
      expect(mockApi.payees.getPayees).not.toHaveBeenCalled();
    });

    it("should handle API error", async () => {
      const apiError = new Error("API Error: Unauthorized");
      mockApi.payees.getPayees.mockRejectedValue(apiError);

      const result = await SyncPayeesTool.execute({}, mockApi as any);

      expect(result.content[0].text).toContain("Error syncing payees:");
      expect(result.content[0].text).toContain("Unauthorized");
    });

    it("should perform delta sync on subsequent calls", async () => {
      // First sync
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });
      await SyncPayeesTool.execute({}, mockApi as any);

      // Second sync (delta)
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: [], server_knowledge: 12345 },
      });
      const result = await SyncPayeesTool.execute({}, mockApi as any);

      expect(mockApi.payees.getPayees).toHaveBeenLastCalledWith(testBudgetId, 12345);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.payee_count).toBe(3);
      expect(parsed.changes.new).toBe(0);
      expect(parsed.changes.updated).toBe(0);
    });
  });

  describe("tool configuration", () => {
    it("should have correct name", () => {
      expect(SyncPayeesTool.name).toBe("sync_payees");
    });

    it("should have correct description", () => {
      expect(SyncPayeesTool.description).toContain("Syncs payees");
      expect(SyncPayeesTool.description).toContain("search_payees");
    });

    it("should have optional budgetId in schema", () => {
      expect(SyncPayeesTool.inputSchema.budgetId).toBeDefined();
    });
  });
});
