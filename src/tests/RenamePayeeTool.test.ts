import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as ynab from "ynab";
import * as RenamePayeeTool from "../tools/RenamePayeeTool";

vi.mock("ynab");

describe("RenamePayeeTool", () => {
  let mockApi: {
    payees: {
      getPayees: Mock;
      updatePayee: Mock;
    };
  };

  const testBudgetId = "test-rename-payee-budget";
  const testCacheDir = path.join(os.homedir(), ".ynab-mcp", "cache", testBudgetId);

  beforeEach(() => {
    vi.clearAllMocks();

    mockApi = {
      payees: {
        getPayees: vi.fn(),
        updatePayee: vi.fn(),
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
        id: "payee-deleted",
        name: "Old Store",
        deleted: true,
        transfer_account_id: null,
      },
    ];

    it("should successfully rename a payee", async () => {
      // Setup cache first
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      // Pre-populate cache by calling getPayees
      await mockApi.payees.getPayees(testBudgetId);

      // Setup update response
      mockApi.payees.updatePayee.mockResolvedValue({
        data: {
          payee: {
            id: "payee-1",
            name: "Amazon Prime",
            deleted: false,
            transfer_account_id: null,
          },
          server_knowledge: 12346,
        },
      });

      const result = await RenamePayeeTool.execute(
        { payeeId: "payee-1", newName: "Amazon Prime" },
        mockApi as any
      );

      expect(mockApi.payees.updatePayee).toHaveBeenCalledWith(
        testBudgetId,
        "payee-1",
        { payee: { name: "Amazon Prime" } }
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe("payee-1");
      expect(parsed.new_name).toBe("Amazon Prime");
      expect(parsed.renamed).toBe(true);
    });

    it("should use custom budget ID when provided", async () => {
      const customBudgetId = "custom-budget-id";
      const customCacheDir = path.join(os.homedir(), ".ynab-mcp", "cache", customBudgetId);

      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      mockApi.payees.updatePayee.mockResolvedValue({
        data: {
          payee: {
            id: "payee-1",
            name: "New Name",
            deleted: false,
            transfer_account_id: null,
          },
          server_knowledge: 12346,
        },
      });

      await RenamePayeeTool.execute(
        { payeeId: "payee-1", newName: "New Name", budgetId: customBudgetId },
        mockApi as any
      );

      expect(mockApi.payees.updatePayee).toHaveBeenCalledWith(
        customBudgetId,
        "payee-1",
        { payee: { name: "New Name" } }
      );

      // Clean up custom cache
      if (fs.existsSync(customCacheDir)) {
        fs.rmSync(customCacheDir, { recursive: true });
      }
    });

    it("should trim whitespace from new name", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      mockApi.payees.updatePayee.mockResolvedValue({
        data: {
          payee: {
            id: "payee-1",
            name: "Trimmed Name",
            deleted: false,
            transfer_account_id: null,
          },
          server_knowledge: 12346,
        },
      });

      await RenamePayeeTool.execute(
        { payeeId: "payee-1", newName: "  Trimmed Name  " },
        mockApi as any
      );

      expect(mockApi.payees.updatePayee).toHaveBeenCalledWith(
        testBudgetId,
        "payee-1",
        { payee: { name: "Trimmed Name" } }
      );
    });

    it("should return error when no budget ID is available", async () => {
      delete process.env.YNAB_BUDGET_ID;

      const result = await RenamePayeeTool.execute(
        { payeeId: "payee-1", newName: "New Name" },
        mockApi as any
      );

      expect(result.content[0].text).toContain("Error renaming payee:");
      expect(result.content[0].text).toContain("No budget ID provided");
      expect(mockApi.payees.updatePayee).not.toHaveBeenCalled();
    });

    it("should return error when no payee ID is provided", async () => {
      const result = await RenamePayeeTool.execute(
        { payeeId: "", newName: "New Name" },
        mockApi as any
      );

      expect(result.content[0].text).toContain("Error renaming payee:");
      expect(result.content[0].text).toContain("Payee ID is required");
      expect(mockApi.payees.updatePayee).not.toHaveBeenCalled();
    });

    it("should return error when new name is empty", async () => {
      const result = await RenamePayeeTool.execute(
        { payeeId: "payee-1", newName: "" },
        mockApi as any
      );

      expect(result.content[0].text).toContain("Error renaming payee:");
      expect(result.content[0].text).toContain("New name is required");
      expect(mockApi.payees.updatePayee).not.toHaveBeenCalled();
    });

    it("should return error when new name is only whitespace", async () => {
      const result = await RenamePayeeTool.execute(
        { payeeId: "payee-1", newName: "   " },
        mockApi as any
      );

      expect(result.content[0].text).toContain("Error renaming payee:");
      expect(result.content[0].text).toContain("New name is required");
      expect(mockApi.payees.updatePayee).not.toHaveBeenCalled();
    });

    it("should return error when new name exceeds 500 characters", async () => {
      const longName = "a".repeat(501);

      const result = await RenamePayeeTool.execute(
        { payeeId: "payee-1", newName: longName },
        mockApi as any
      );

      expect(result.content[0].text).toContain("Error renaming payee:");
      expect(result.content[0].text).toContain("cannot exceed 500 characters");
      expect(mockApi.payees.updatePayee).not.toHaveBeenCalled();
    });

    it("should handle API error", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const apiError = new Error("API Error: Not Found");
      mockApi.payees.updatePayee.mockRejectedValue(apiError);

      const result = await RenamePayeeTool.execute(
        { payeeId: "payee-1", newName: "New Name" },
        mockApi as any
      );

      expect(result.content[0].text).toContain("Error renaming payee:");
      expect(result.content[0].text).toContain("Not Found");
    });

    it("should return error when trying to rename deleted payee from cache", async () => {
      // First populate the cache
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      // Need to sync cache first by making a call that populates it
      const { syncPayees } = await import("../cache/payees.js");
      await syncPayees(testBudgetId, mockApi as any);

      const result = await RenamePayeeTool.execute(
        { payeeId: "payee-deleted", newName: "New Name" },
        mockApi as any
      );

      expect(result.content[0].text).toContain("Cannot rename payee");
      expect(result.content[0].text).toContain("has been deleted");
      expect(mockApi.payees.updatePayee).not.toHaveBeenCalled();
    });

    it("should sync cache after successful rename", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      mockApi.payees.updatePayee.mockResolvedValue({
        data: {
          payee: {
            id: "payee-1",
            name: "New Name",
            deleted: false,
            transfer_account_id: null,
          },
          server_knowledge: 12346,
        },
      });

      await RenamePayeeTool.execute(
        { payeeId: "payee-1", newName: "New Name" },
        mockApi as any
      );

      // getPayees should be called twice: once for cache check (if cache exists) and once for sync after rename
      expect(mockApi.payees.getPayees).toHaveBeenCalled();
    });
  });

  describe("tool configuration", () => {
    it("should have correct name", () => {
      expect(RenamePayeeTool.name).toBe("rename_payee");
    });

    it("should have correct description", () => {
      expect(RenamePayeeTool.description).toContain("Rename");
      expect(RenamePayeeTool.description).toContain("payee");
    });

    it("should have required payeeId in schema", () => {
      expect(RenamePayeeTool.inputSchema.payeeId).toBeDefined();
    });

    it("should have required newName in schema", () => {
      expect(RenamePayeeTool.inputSchema.newName).toBeDefined();
    });

    it("should have optional budgetId in schema", () => {
      expect(RenamePayeeTool.inputSchema.budgetId).toBeDefined();
    });
  });
});
