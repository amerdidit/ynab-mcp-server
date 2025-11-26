import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as ynab from "ynab";
import * as GetCategoryTool from "../tools/GetCategoryTool";
import { writeCache } from "../cache/index";

vi.mock("ynab");

describe("GetCategoryTool", () => {
  let mockApi: {
    categories: {
      getCategories: Mock;
    };
  };

  const testBudgetId = "test-get-category-budget";
  const testCacheDir = path.join(os.homedir(), ".ynab-mcp", "cache", testBudgetId);

  const mockCategoriesCache = {
    server_knowledge: 12345,
    last_synced: "2024-01-15T10:00:00.000Z",
    category_groups: [
      { id: "group-1", name: "Bills", hidden: false, deleted: false },
    ],
    categories: [
      {
        id: "cat-1",
        name: "Rent",
        category_group_id: "group-1",
        category_group_name: "Bills",
        hidden: false,
        deleted: false,
        note: "Monthly rent payment",
        budgeted: 150000,
        activity: -150000,
        balance: 0,
        goal_type: "NEED",
        goal_percentage_complete: 100,
      },
      {
        id: "cat-2",
        name: "Electric",
        category_group_id: "group-1",
        category_group_name: "Bills",
        hidden: false,
        deleted: false,
        note: null,
        budgeted: 10000,
        activity: -8500,
        balance: 1500,
        goal_type: null,
        goal_percentage_complete: null,
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
    it("should return category details when found", async () => {
      writeCache(testBudgetId, "categories.json", mockCategoriesCache);

      const result = await GetCategoryTool.execute({ categoryId: "cat-1" }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.auto_synced).toBe(false);
      expect(parsed.category.id).toBe("cat-1");
      expect(parsed.category.name).toBe("Rent");
      expect(parsed.category.group_name).toBe("Bills");
      expect(parsed.category.note).toBe("Monthly rent payment");
      expect(parsed.category.budgeted).toBe(150);
      expect(parsed.category.activity).toBe(-150);
      expect(parsed.category.balance).toBe(0);
      expect(parsed.category.goal_type).toBe("NEED");
      expect(parsed.category.goal_percentage_complete).toBe(100);
    });

    it("should convert amounts from milliunits", async () => {
      writeCache(testBudgetId, "categories.json", mockCategoriesCache);

      const result = await GetCategoryTool.execute({ categoryId: "cat-2" }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.category.budgeted).toBe(10);
      expect(parsed.category.activity).toBe(-8.5);
      expect(parsed.category.balance).toBe(1.5);
    });

    it("should return error when category not found", async () => {
      writeCache(testBudgetId, "categories.json", mockCategoriesCache);

      const result = await GetCategoryTool.execute({ categoryId: "nonexistent" }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("Category not found");
      expect(parsed.category_id).toBe("nonexistent");
      expect(parsed.hint).toContain("search_categories");
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
              budgeted: 150000,
              activity: -150000,
              balance: 0,
              goal_type: null,
              goal_percentage_complete: null,
            },
          ],
        },
      ];

      mockApi.categories.getCategories.mockResolvedValue({
        data: { category_groups: mockCategoryGroupsData, server_knowledge: 12345 },
      });

      const result = await GetCategoryTool.execute({ categoryId: "cat-1" }, mockApi as any);

      expect(mockApi.categories.getCategories).toHaveBeenCalled();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.auto_synced).toBe(true);
      expect(parsed.category.name).toBe("Rent");
    });

    it("should use custom budget ID when provided", async () => {
      const customBudgetId = "custom-budget-id";
      const customCacheDir = path.join(os.homedir(), ".ynab-mcp", "cache", customBudgetId);

      writeCache(customBudgetId, "categories.json", mockCategoriesCache);

      const result = await GetCategoryTool.execute(
        { budgetId: customBudgetId, categoryId: "cat-1" },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.category.name).toBe("Rent");

      // Clean up custom cache
      if (fs.existsSync(customCacheDir)) {
        fs.rmSync(customCacheDir, { recursive: true });
      }
    });

    it("should return error when no budget ID is available", async () => {
      delete process.env.YNAB_BUDGET_ID;

      const result = await GetCategoryTool.execute({ categoryId: "cat-1" }, mockApi as any);

      expect(result.content[0].text).toContain("Error getting category:");
      expect(result.content[0].text).toContain("No budget ID provided");
    });

    it("should handle API errors during auto-sync", async () => {
      const apiError = new Error("API Error: Unauthorized");
      mockApi.categories.getCategories.mockRejectedValue(apiError);

      const result = await GetCategoryTool.execute({ categoryId: "cat-1" }, mockApi as any);

      expect(result.content[0].text).toContain("Error getting category:");
      expect(result.content[0].text).toContain("Unauthorized");
    });
  });

  describe("tool configuration", () => {
    it("should have correct name", () => {
      expect(GetCategoryTool.name).toBe("get_category");
    });

    it("should have correct description", () => {
      expect(GetCategoryTool.description).toContain("Get a single category");
      expect(GetCategoryTool.description).toContain("by ID");
    });

    it("should have required categoryId in schema", () => {
      expect(GetCategoryTool.inputSchema.categoryId).toBeDefined();
    });

    it("should have optional budgetId in schema", () => {
      expect(GetCategoryTool.inputSchema.budgetId).toBeDefined();
    });
  });
});
