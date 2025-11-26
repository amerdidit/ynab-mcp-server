import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as ynab from "ynab";
import * as SearchPayeesTool from "../tools/SearchPayeesTool";

vi.mock("ynab");

describe("SearchPayeesTool", () => {
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
      { id: "payee-1", name: "Amazon", deleted: false, transfer_account_id: null },
      { id: "payee-2", name: "AMAZON.COM", deleted: false, transfer_account_id: null },
      { id: "payee-3", name: "Amazon Prime", deleted: false, transfer_account_id: null },
      { id: "payee-4", name: "Grocery Store", deleted: false, transfer_account_id: null },
      { id: "payee-5", name: "Transfer: Savings", deleted: false, transfer_account_id: "account-123" },
      { id: "payee-6", name: "Old Amazon Store", deleted: true, transfer_account_id: null },
    ];

    it("should find payees matching search query", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await SearchPayeesTool.execute({ query: "amazon" }, mockApi as any);

      expect(mockApi.payees.getPayees).toHaveBeenCalledWith(testBudgetId, undefined);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.query).toBe("amazon");
      expect(parsed.match_count).toBe(3);
      expect(parsed.payees).toHaveLength(3);
      expect(parsed.payees.map((p: any) => p.name)).toContain("Amazon");
      expect(parsed.payees.map((p: any) => p.name)).toContain("AMAZON.COM");
      expect(parsed.payees.map((p: any) => p.name)).toContain("Amazon Prime");
    });

    it("should be case-insensitive", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await SearchPayeesTool.execute({ query: "AMAZON" }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.match_count).toBe(3);
    });

    it("should filter out deleted payees", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await SearchPayeesTool.execute({ query: "amazon" }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.payees.find((p: any) => p.id === "payee-6")).toBeUndefined();
    });

    it("should return empty results when no matches", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await SearchPayeesTool.execute({ query: "nonexistent" }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.match_count).toBe(0);
      expect(parsed.payees).toEqual([]);
    });

    it("should include transfer_account_id in results", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await SearchPayeesTool.execute({ query: "transfer" }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.match_count).toBe(1);
      expect(parsed.payees[0].transfer_account_id).toBe("account-123");
    });

    it("should use custom budget ID when provided", async () => {
      const customBudgetId = "custom-budget-id";
      const customCacheDir = path.join(os.homedir(), ".ynab-mcp", "cache", customBudgetId);

      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      await SearchPayeesTool.execute({ query: "amazon", budgetId: customBudgetId }, mockApi as any);

      expect(mockApi.payees.getPayees).toHaveBeenCalledWith(customBudgetId, undefined);

      // Clean up custom cache
      if (fs.existsSync(customCacheDir)) {
        fs.rmSync(customCacheDir, { recursive: true });
      }
    });

    it("should return error when no budget ID is available", async () => {
      delete process.env.YNAB_BUDGET_ID;

      const result = await SearchPayeesTool.execute({ query: "amazon" }, mockApi as any);

      expect(result.content[0].text).toContain("Error searching payees:");
      expect(result.content[0].text).toContain("No budget ID provided");
      expect(mockApi.payees.getPayees).not.toHaveBeenCalled();
    });

    it("should return error when no query is provided", async () => {
      const result = await SearchPayeesTool.execute({ query: "" }, mockApi as any);

      expect(result.content[0].text).toContain("Error searching payees:");
      expect(result.content[0].text).toContain("Search query is required");
      expect(mockApi.payees.getPayees).not.toHaveBeenCalled();
    });

    it("should handle API error", async () => {
      const apiError = new Error("API Error: Unauthorized");
      mockApi.payees.getPayees.mockRejectedValue(apiError);

      const result = await SearchPayeesTool.execute({ query: "amazon" }, mockApi as any);

      expect(result.content[0].text).toContain("Error searching payees:");
      expect(result.content[0].text).toContain("Unauthorized");
    });

    it("should find partial matches", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await SearchPayeesTool.execute({ query: "zon" }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.match_count).toBe(3); // Amazon, AMAZON.COM, Amazon Prime
    });

    it("should respect limit parameter", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await SearchPayeesTool.execute({ query: "amazon", limit: 2 }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.match_count).toBe(3);
      expect(parsed.showing).toBe(2);
      expect(parsed.payees).toHaveLength(2);
      expect(parsed.truncated).toBe(true);
    });

    it("should indicate when results are not truncated", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });

      const result = await SearchPayeesTool.execute({ query: "grocery" }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.match_count).toBe(1);
      expect(parsed.showing).toBe(1);
      expect(parsed.truncated).toBe(false);
    });

    it("should perform delta sync on subsequent calls", async () => {
      // First call - full sync
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: mockPayeesData, server_knowledge: 12345 },
      });
      await SearchPayeesTool.execute({ query: "amazon" }, mockApi as any);

      // Second call - delta sync
      mockApi.payees.getPayees.mockResolvedValue({
        data: { payees: [], server_knowledge: 12345 },
      });
      await SearchPayeesTool.execute({ query: "amazon" }, mockApi as any);

      expect(mockApi.payees.getPayees).toHaveBeenLastCalledWith(testBudgetId, 12345);
    });
  });

  describe("tool configuration", () => {
    it("should have correct name", () => {
      expect(SearchPayeesTool.name).toBe("search_payees");
    });

    it("should have correct description", () => {
      expect(SearchPayeesTool.description).toContain("search");
      expect(SearchPayeesTool.description).toContain("payees");
      expect(SearchPayeesTool.description).toContain("case-insensitive");
    });

    it("should have required query in schema", () => {
      expect(SearchPayeesTool.inputSchema.query).toBeDefined();
    });

    it("should have optional budgetId in schema", () => {
      expect(SearchPayeesTool.inputSchema.budgetId).toBeDefined();
    });

    it("should have optional limit in schema", () => {
      expect(SearchPayeesTool.inputSchema.limit).toBeDefined();
    });
  });
});
