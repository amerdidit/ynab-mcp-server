import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as ynab from "ynab";
import {
  getCacheDir,
  readCache,
  writeCache,
  deleteCache,
  clearBudgetCache,
} from "../cache/index";
import {
  syncPayees,
  getPayeesFromCache,
  getActivePayees,
  searchPayeesInCache,
  findPayeeById,
  PayeesCache,
} from "../cache/payees";

vi.mock("ynab");

describe("Cache Module", () => {
  const testBudgetId = "test-budget-123";
  const testCacheDir = path.join(os.homedir(), ".ynab-mcp", "cache", testBudgetId);

  afterEach(() => {
    // Clean up test cache directory
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true });
    }
  });

  describe("getCacheDir", () => {
    it("should create and return cache directory path", () => {
      const dir = getCacheDir(testBudgetId);
      expect(dir).toBe(testCacheDir);
      expect(fs.existsSync(dir)).toBe(true);
    });

    it("should return existing directory without error", () => {
      getCacheDir(testBudgetId);
      const dir = getCacheDir(testBudgetId);
      expect(dir).toBe(testCacheDir);
    });
  });

  describe("readCache / writeCache", () => {
    it("should write and read JSON data", () => {
      const testData = { foo: "bar", count: 42 };
      writeCache(testBudgetId, "test.json", testData);
      const result = readCache<typeof testData>(testBudgetId, "test.json");
      expect(result).toEqual(testData);
    });

    it("should return undefined for non-existent file", () => {
      const result = readCache(testBudgetId, "nonexistent.json");
      expect(result).toBeUndefined();
    });
  });

  describe("deleteCache", () => {
    it("should delete existing cache file", () => {
      writeCache(testBudgetId, "test.json", { data: "test" });
      const result = deleteCache(testBudgetId, "test.json");
      expect(result).toBe(true);
      expect(readCache(testBudgetId, "test.json")).toBeUndefined();
    });

    it("should return false for non-existent file", () => {
      const result = deleteCache(testBudgetId, "nonexistent.json");
      expect(result).toBe(false);
    });
  });

  describe("clearBudgetCache", () => {
    it("should remove entire budget cache directory", () => {
      writeCache(testBudgetId, "file1.json", { a: 1 });
      writeCache(testBudgetId, "file2.json", { b: 2 });
      clearBudgetCache(testBudgetId);
      expect(fs.existsSync(testCacheDir)).toBe(false);
    });
  });
});

describe("Payees Cache Module", () => {
  const testBudgetId = "test-budget-payees";
  const testCacheDir = path.join(os.homedir(), ".ynab-mcp", "cache", testBudgetId);

  let mockApi: {
    payees: {
      getPayees: Mock;
    };
  };

  const mockPayeesData = [
    { id: "payee-1", name: "Amazon", deleted: false, transfer_account_id: null },
    { id: "payee-2", name: "Grocery Store", deleted: false, transfer_account_id: null },
    { id: "payee-3", name: "Transfer: Savings", deleted: false, transfer_account_id: "account-123" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockApi = {
      payees: {
        getPayees: vi.fn(),
      },
    };

    (ynab.API as any).mockImplementation(() => mockApi);
  });

  afterEach(() => {
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true });
    }
  });

  describe("syncPayees", () => {
    it("should create fresh cache on first sync", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: {
          payees: mockPayeesData,
          server_knowledge: 12345,
        },
      });

      const result = await syncPayees(testBudgetId, mockApi as any);

      expect(mockApi.payees.getPayees).toHaveBeenCalledWith(testBudgetId, undefined);
      expect(result.cache.server_knowledge).toBe(12345);
      expect(result.cache.payees).toHaveLength(3);
      expect(result.stats.total).toBe(3);
      expect(result.stats.new).toBe(3);
      expect(result.stats.updated).toBe(0);
      expect(result.stats.deleted).toBe(0);
    });

    it("should use server_knowledge for delta sync", async () => {
      // First sync
      mockApi.payees.getPayees.mockResolvedValue({
        data: {
          payees: mockPayeesData,
          server_knowledge: 12345,
        },
      });
      await syncPayees(testBudgetId, mockApi as any);

      // Delta sync with new payee
      mockApi.payees.getPayees.mockResolvedValue({
        data: {
          payees: [{ id: "payee-4", name: "New Store", deleted: false, transfer_account_id: null }],
          server_knowledge: 12346,
        },
      });
      const result = await syncPayees(testBudgetId, mockApi as any);

      expect(mockApi.payees.getPayees).toHaveBeenCalledWith(testBudgetId, 12345);
      expect(result.cache.server_knowledge).toBe(12346);
      expect(result.cache.payees).toHaveLength(4);
      expect(result.stats.total).toBe(4);
      expect(result.stats.new).toBe(1);
    });

    it("should track updated payees", async () => {
      // First sync
      mockApi.payees.getPayees.mockResolvedValue({
        data: {
          payees: mockPayeesData,
          server_knowledge: 12345,
        },
      });
      await syncPayees(testBudgetId, mockApi as any);

      // Update existing payee
      mockApi.payees.getPayees.mockResolvedValue({
        data: {
          payees: [{ id: "payee-1", name: "Amazon Updated", deleted: false, transfer_account_id: null }],
          server_knowledge: 12346,
        },
      });
      const result = await syncPayees(testBudgetId, mockApi as any);

      expect(result.stats.updated).toBe(1);
      const amazon = result.cache.payees.find((p) => p.id === "payee-1");
      expect(amazon?.name).toBe("Amazon Updated");
    });

    it("should track deleted payees", async () => {
      // First sync
      mockApi.payees.getPayees.mockResolvedValue({
        data: {
          payees: mockPayeesData,
          server_knowledge: 12345,
        },
      });
      await syncPayees(testBudgetId, mockApi as any);

      // Delete a payee
      mockApi.payees.getPayees.mockResolvedValue({
        data: {
          payees: [{ id: "payee-1", name: "Amazon", deleted: true, transfer_account_id: null }],
          server_knowledge: 12346,
        },
      });
      const result = await syncPayees(testBudgetId, mockApi as any);

      expect(result.stats.deleted).toBe(1);
      expect(result.stats.total).toBe(2); // Only non-deleted count
    });

    it("should handle empty delta response", async () => {
      // First sync
      mockApi.payees.getPayees.mockResolvedValue({
        data: {
          payees: mockPayeesData,
          server_knowledge: 12345,
        },
      });
      await syncPayees(testBudgetId, mockApi as any);

      // No changes
      mockApi.payees.getPayees.mockResolvedValue({
        data: {
          payees: [],
          server_knowledge: 12345,
        },
      });
      const result = await syncPayees(testBudgetId, mockApi as any);

      expect(result.stats.new).toBe(0);
      expect(result.stats.updated).toBe(0);
      expect(result.stats.deleted).toBe(0);
      expect(result.stats.total).toBe(3);
    });
  });

  describe("getPayeesFromCache", () => {
    it("should return undefined when no cache exists", () => {
      const result = getPayeesFromCache(testBudgetId);
      expect(result).toBeUndefined();
    });

    it("should return cache after sync", async () => {
      mockApi.payees.getPayees.mockResolvedValue({
        data: {
          payees: mockPayeesData,
          server_knowledge: 12345,
        },
      });
      await syncPayees(testBudgetId, mockApi as any);

      const cache = getPayeesFromCache(testBudgetId);
      expect(cache).toBeDefined();
      expect(cache?.payees).toHaveLength(3);
    });
  });

  describe("getActivePayees", () => {
    it("should filter out deleted payees", () => {
      const cache: PayeesCache = {
        server_knowledge: 12345,
        last_synced: new Date().toISOString(),
        payees: [
          { id: "p1", name: "Active", deleted: false, transfer_account_id: null },
          { id: "p2", name: "Deleted", deleted: true, transfer_account_id: null },
          { id: "p3", name: "Also Active", deleted: false, transfer_account_id: null },
        ],
      };

      const active = getActivePayees(cache);
      expect(active).toHaveLength(2);
      expect(active.find((p) => p.id === "p2")).toBeUndefined();
    });
  });

  describe("searchPayeesInCache", () => {
    const cache: PayeesCache = {
      server_knowledge: 12345,
      last_synced: new Date().toISOString(),
      payees: [
        { id: "p1", name: "Amazon", deleted: false, transfer_account_id: null },
        { id: "p2", name: "AMAZON.COM", deleted: false, transfer_account_id: null },
        { id: "p3", name: "Amazon Prime", deleted: false, transfer_account_id: null },
        { id: "p4", name: "Grocery Store", deleted: false, transfer_account_id: null },
        { id: "p5", name: "Deleted Amazon", deleted: true, transfer_account_id: null },
      ],
    };

    it("should find payees by name (case-insensitive)", () => {
      const results = searchPayeesInCache(cache, "amazon");
      expect(results).toHaveLength(3);
    });

    it("should find payees by partial match", () => {
      const results = searchPayeesInCache(cache, "zon");
      expect(results).toHaveLength(3);
    });

    it("should exclude deleted payees", () => {
      const results = searchPayeesInCache(cache, "amazon");
      expect(results.find((p) => p.id === "p5")).toBeUndefined();
    });

    it("should return empty array when no matches", () => {
      const results = searchPayeesInCache(cache, "nonexistent");
      expect(results).toEqual([]);
    });
  });

  describe("findPayeeById", () => {
    const cache: PayeesCache = {
      server_knowledge: 12345,
      last_synced: new Date().toISOString(),
      payees: [
        { id: "p1", name: "Amazon", deleted: false, transfer_account_id: null },
        { id: "p2", name: "Deleted", deleted: true, transfer_account_id: null },
      ],
    };

    it("should find payee by ID", () => {
      const payee = findPayeeById(cache, "p1");
      expect(payee).toBeDefined();
      expect(payee?.name).toBe("Amazon");
    });

    it("should find deleted payees by ID", () => {
      const payee = findPayeeById(cache, "p2");
      expect(payee).toBeDefined();
      expect(payee?.deleted).toBe(true);
    });

    it("should return undefined for non-existent ID", () => {
      const payee = findPayeeById(cache, "nonexistent");
      expect(payee).toBeUndefined();
    });
  });
});
