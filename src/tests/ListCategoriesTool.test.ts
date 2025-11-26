import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as ynab from "ynab";
import * as ListCategoriesTool from "../tools/ListCategoriesTool";
import { writeCache } from "../cache/index";

vi.mock("ynab");

describe("ListCategoriesTool", () => {
  let mockApi: {
    categories: {
      getCategories: Mock;
    };
  };

  const testBudgetId = "test-list-categories-budget";
  const testCacheDir = path.join(os.homedir(), ".ynab-mcp", "cache", testBudgetId);

  const mockCategoriesCache = {
    server_knowledge: 12345,
    last_synced: "2024-01-15T10:00:00.000Z",
    category_groups: [
      { id: "group-1", name: "Bills", hidden: false, deleted: false },
      { id: "group-2", name: "Groceries", hidden: false, deleted: false },
    ],
    categories: [
      {
        id: "cat-1",
        name: "Rent",
        category_group_id: "group-1",
        category_group_name: "Bills",
        hidden: false,
        deleted: false,
        note: null,
        budgeted: 1500000,
        activity: -1500000,
        balance: 0,
        goal_type: "MF",
        goal_percentage_complete: 100,
      },
      {
        id: "cat-2",
        name: "Utilities",
        category_group_id: "group-1",
        category_group_name: "Bills",
        hidden: false,
        deleted: false,
        note: null,
        budgeted: 200000,
        activity: -150000,
        balance: 50000,
        goal_type: null,
        goal_percentage_complete: null,
      },
      {
        id: "cat-3",
        name: "Food",
        category_group_id: "group-2",
        category_group_name: "Groceries",
        hidden: false,
        deleted: false,
        note: null,
        budgeted: 500000,
        activity: -300000,
        balance: 200000,
        goal_type: "NEED",
        goal_percentage_complete: 60,
      },
    ],
  };

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
    it("should successfully list all categories from cache", async () => {
      writeCache(testBudgetId, "categories.json", mockCategoriesCache);

      const result = await ListCategoriesTool.execute({}, mockApi as any);

      // Should NOT call API when cache exists
      expect(mockApi.categories.getCategories).not.toHaveBeenCalled();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.group_count).toBe(2);
      expect(parsed.category_count).toBe(3);
      expect(parsed.category_groups[0].name).toBe("Bills");
      expect(parsed.category_groups[0].categories).toHaveLength(2);
      expect(parsed.auto_synced).toBe(false);
      expect(parsed.last_synced).toBe("2024-01-15T10:00:00.000Z");
    });

    it("should auto-sync when cache is empty", async () => {
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
              budgeted: 1500000,
              activity: -1500000,
              balance: 0,
              goal_type: "MF",
              goal_percentage_complete: 100,
            },
          ],
        },
      ];

      mockApi.categories.getCategories.mockResolvedValue({
        data: { category_groups: mockCategoryGroupsData, server_knowledge: 12345 },
      });

      const result = await ListCategoriesTool.execute({}, mockApi as any);

      expect(mockApi.categories.getCategories).toHaveBeenCalledWith(testBudgetId, undefined);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.group_count).toBe(1);
      expect(parsed.category_count).toBe(1);
      expect(parsed.auto_synced).toBe(true);
    });

    it("should filter out deleted and hidden items", async () => {
      const cacheWithDeletedHidden = {
        ...mockCategoriesCache,
        category_groups: [
          ...mockCategoriesCache.category_groups,
          { id: "group-deleted", name: "Deleted Group", hidden: false, deleted: true },
          { id: "group-hidden", name: "Hidden Group", hidden: true, deleted: false },
        ],
        categories: [
          ...mockCategoriesCache.categories,
          {
            id: "cat-deleted",
            name: "Deleted Category",
            category_group_id: "group-1",
            category_group_name: "Bills",
            hidden: false,
            deleted: true,
            note: null,
            budgeted: 0,
            activity: 0,
            balance: 0,
            goal_type: null,
            goal_percentage_complete: null,
          },
          {
            id: "cat-hidden",
            name: "Hidden Category",
            category_group_id: "group-1",
            category_group_name: "Bills",
            hidden: true,
            deleted: false,
            note: null,
            budgeted: 0,
            activity: 0,
            balance: 0,
            goal_type: null,
            goal_percentage_complete: null,
          },
        ],
      };

      writeCache(testBudgetId, "categories.json", cacheWithDeletedHidden);

      const result = await ListCategoriesTool.execute({}, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.group_count).toBe(2);
      expect(parsed.category_count).toBe(3);
      expect(parsed.category_groups.find((g: any) => g.id === "group-deleted")).toBeUndefined();
      expect(parsed.category_groups.find((g: any) => g.id === "group-hidden")).toBeUndefined();
    });

    it("should use custom budget ID when provided", async () => {
      const customBudgetId = "custom-list-categories-budget";
      const customCacheDir = path.join(os.homedir(), ".ynab-mcp", "cache", customBudgetId);

      writeCache(customBudgetId, "categories.json", mockCategoriesCache);

      const result = await ListCategoriesTool.execute({ budgetId: customBudgetId }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.group_count).toBe(2);

      // Clean up custom cache
      if (fs.existsSync(customCacheDir)) {
        fs.rmSync(customCacheDir, { recursive: true });
      }
    });

    it("should handle empty category list", async () => {
      const emptyCache = {
        server_knowledge: 12345,
        last_synced: "2024-01-15T10:00:00.000Z",
        category_groups: [],
        categories: [],
      };

      writeCache(testBudgetId, "categories.json", emptyCache);

      const result = await ListCategoriesTool.execute({}, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.group_count).toBe(0);
      expect(parsed.category_count).toBe(0);
      expect(parsed.category_groups).toEqual([]);
    });

    it("should return error when no budget ID is available", async () => {
      delete process.env.YNAB_BUDGET_ID;

      const result = await ListCategoriesTool.execute({}, mockApi as any);

      expect(result.content[0].text).toContain("Error listing categories:");
      expect(result.content[0].text).toContain("No budget ID provided");
      expect(mockApi.categories.getCategories).not.toHaveBeenCalled();
    });

    it("should handle API error during auto-sync", async () => {
      const apiError = new Error("API Error: Unauthorized");
      mockApi.categories.getCategories.mockRejectedValue(apiError);

      const result = await ListCategoriesTool.execute({}, mockApi as any);

      expect(result.content[0].text).toContain("Error listing categories:");
      expect(result.content[0].text).toContain("Unauthorized");
    });

    it("should convert milliunits to dollars correctly", async () => {
      writeCache(testBudgetId, "categories.json", mockCategoriesCache);

      const result = await ListCategoriesTool.execute({}, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      const rentCategory = parsed.category_groups[0].categories[0];
      expect(rentCategory.budgeted).toBe(1500);
      expect(rentCategory.activity).toBe(-1500);
      expect(rentCategory.balance).toBe(0);
    });

    it("should include goal information", async () => {
      writeCache(testBudgetId, "categories.json", mockCategoriesCache);

      const result = await ListCategoriesTool.execute({}, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      const rentCategory = parsed.category_groups[0].categories[0];
      expect(rentCategory.goal_type).toBe("MF");
      expect(rentCategory.goal_percentage_complete).toBe(100);

      const utilitiesCategory = parsed.category_groups[0].categories[1];
      expect(utilitiesCategory.goal_type).toBeNull();
      expect(utilitiesCategory.goal_percentage_complete).toBeNull();
    });
  });

  describe("tool configuration", () => {
    it("should have correct name", () => {
      expect(ListCategoriesTool.name).toBe("list_categories");
    });

    it("should have correct description", () => {
      expect(ListCategoriesTool.description).toContain("categories");
      expect(ListCategoriesTool.description).toContain("category IDs");
    });

    it("should have optional budgetId in schema", () => {
      expect(ListCategoriesTool.inputSchema.budgetId).toBeDefined();
    });
  });
});
