import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as ynab from "ynab";
import * as SyncCategoriesTool from "../tools/SyncCategoriesTool";

vi.mock("ynab");

describe("SyncCategoriesTool", () => {
  let mockApi: {
    categories: {
      getCategories: Mock;
    };
  };

  const testBudgetId = "test-sync-categories-budget";
  const testCacheDir = path.join(os.homedir(), ".ynab-mcp", "cache", testBudgetId);

  beforeEach(() => {
    vi.clearAllMocks();

    mockApi = {
      categories: {
        getCategories: vi.fn(),
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
    const mockCategoryGroupsData = [
      {
        id: "group-1",
        name: "Bills",
        hidden: false,
        deleted: false,
        categories: [
          {
            id: "cat-1",
            name: "Rent",
            category_group_id: "group-1",
            hidden: false,
            deleted: false,
            note: null,
            budgeted: 150000,
            activity: -150000,
            balance: 0,
            goal_type: null,
            goal_percentage_complete: null,
          },
          {
            id: "cat-2",
            name: "Electric",
            category_group_id: "group-1",
            hidden: false,
            deleted: false,
            note: "Monthly electric bill",
            budgeted: 10000,
            activity: -8500,
            balance: 1500,
            goal_type: "NEED",
            goal_percentage_complete: 100,
          },
        ],
      },
      {
        id: "group-2",
        name: "Savings",
        hidden: false,
        deleted: false,
        categories: [
          {
            id: "cat-3",
            name: "Emergency Fund",
            category_group_id: "group-2",
            hidden: false,
            deleted: false,
            note: null,
            budgeted: 50000,
            activity: 0,
            balance: 500000,
            goal_type: "TB",
            goal_percentage_complete: 50,
          },
        ],
      },
    ];

    it("should return category count and sync stats on first sync", async () => {
      mockApi.categories.getCategories.mockResolvedValue({
        data: { category_groups: mockCategoryGroupsData, server_knowledge: 12345 },
      });

      const result = await SyncCategoriesTool.execute({}, mockApi as any);

      expect(mockApi.categories.getCategories).toHaveBeenCalledWith(testBudgetId, undefined);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.group_count).toBe(2);
      expect(parsed.category_count).toBe(3);
      expect(parsed.synced).toBe(true);
      expect(parsed.changes.groups.new).toBe(2);
      expect(parsed.changes.categories.new).toBe(3);
      expect(parsed.hint).toContain("search_categories");
    });

    it("should filter out hidden and deleted items from count", async () => {
      const dataWithHiddenDeleted = [
        ...mockCategoryGroupsData,
        {
          id: "group-hidden",
          name: "Hidden Group",
          hidden: true,
          deleted: false,
          categories: [],
        },
        {
          id: "group-deleted",
          name: "Deleted Group",
          hidden: false,
          deleted: true,
          categories: [
            {
              id: "cat-deleted",
              name: "Deleted Category",
              category_group_id: "group-deleted",
              hidden: false,
              deleted: true,
              note: null,
              budgeted: 0,
              activity: 0,
              balance: 0,
              goal_type: null,
              goal_percentage_complete: null,
            },
          ],
        },
      ];

      mockApi.categories.getCategories.mockResolvedValue({
        data: { category_groups: dataWithHiddenDeleted, server_knowledge: 12345 },
      });

      const result = await SyncCategoriesTool.execute({}, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.group_count).toBe(2);
      expect(parsed.category_count).toBe(3);
    });

    it("should use custom budget ID when provided", async () => {
      const customBudgetId = "custom-sync-categories-budget";
      const customCacheDir = path.join(os.homedir(), ".ynab-mcp", "cache", customBudgetId);

      // Clean up first to ensure fresh sync
      if (fs.existsSync(customCacheDir)) {
        fs.rmSync(customCacheDir, { recursive: true });
      }

      mockApi.categories.getCategories.mockResolvedValue({
        data: { category_groups: mockCategoryGroupsData, server_knowledge: 12345 },
      });

      await SyncCategoriesTool.execute({ budgetId: customBudgetId }, mockApi as any);

      expect(mockApi.categories.getCategories).toHaveBeenCalledWith(customBudgetId, undefined);

      // Clean up custom cache
      if (fs.existsSync(customCacheDir)) {
        fs.rmSync(customCacheDir, { recursive: true });
      }
    });

    it("should handle empty category list", async () => {
      mockApi.categories.getCategories.mockResolvedValue({
        data: { category_groups: [], server_knowledge: 12345 },
      });

      const result = await SyncCategoriesTool.execute({}, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.group_count).toBe(0);
      expect(parsed.category_count).toBe(0);
    });

    it("should return error when no budget ID is available", async () => {
      delete process.env.YNAB_BUDGET_ID;

      const result = await SyncCategoriesTool.execute({}, mockApi as any);

      expect(result.content[0].text).toContain("Error syncing categories:");
      expect(result.content[0].text).toContain("No budget ID provided");
      expect(mockApi.categories.getCategories).not.toHaveBeenCalled();
    });

    it("should handle API error", async () => {
      const apiError = new Error("API Error: Unauthorized");
      mockApi.categories.getCategories.mockRejectedValue(apiError);

      const result = await SyncCategoriesTool.execute({}, mockApi as any);

      expect(result.content[0].text).toContain("Error syncing categories:");
      expect(result.content[0].text).toContain("Unauthorized");
    });

    it("should perform delta sync on subsequent calls", async () => {
      // First sync
      mockApi.categories.getCategories.mockResolvedValue({
        data: { category_groups: mockCategoryGroupsData, server_knowledge: 12345 },
      });
      await SyncCategoriesTool.execute({}, mockApi as any);

      // Second sync (delta)
      mockApi.categories.getCategories.mockResolvedValue({
        data: { category_groups: [], server_knowledge: 12346 },
      });
      const result = await SyncCategoriesTool.execute({}, mockApi as any);

      expect(mockApi.categories.getCategories).toHaveBeenLastCalledWith(testBudgetId, 12345);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.group_count).toBe(2);
      expect(parsed.category_count).toBe(3);
      expect(parsed.changes.groups.new).toBe(0);
      expect(parsed.changes.categories.new).toBe(0);
    });
  });

  describe("tool configuration", () => {
    it("should have correct name", () => {
      expect(SyncCategoriesTool.name).toBe("sync_categories");
    });

    it("should have correct description", () => {
      expect(SyncCategoriesTool.description).toContain("Syncs categories");
      expect(SyncCategoriesTool.description).toContain("search_categories");
    });

    it("should have optional budgetId in schema", () => {
      expect(SyncCategoriesTool.inputSchema.budgetId).toBeDefined();
    });
  });
});
