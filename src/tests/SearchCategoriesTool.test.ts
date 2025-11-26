import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as ynab from "ynab";
import * as SearchCategoriesTool from "../tools/SearchCategoriesTool";
import { writeCache } from "../cache/index";

vi.mock("ynab");

describe("SearchCategoriesTool", () => {
  let mockApi: {
    categories: {
      getCategories: Mock;
    };
  };

  const testBudgetId = "test-search-categories-budget";
  const testCacheDir = path.join(os.homedir(), ".ynab-mcp", "cache", testBudgetId);

  const mockCategoriesCache = {
    server_knowledge: 12345,
    last_synced: "2024-01-15T10:00:00.000Z",
    category_groups: [
      { id: "group-1", name: "Bills", hidden: false, deleted: false },
      { id: "group-2", name: "Savings Goals", hidden: false, deleted: false },
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
        category_group_name: "Bills",
        hidden: false,
        deleted: false,
        note: "Monthly electric bill",
        budgeted: 10000,
        activity: -8500,
        balance: 1500,
        goal_type: "NEED",
        goal_percentage_complete: 100,
      },
      {
        id: "cat-3",
        name: "Emergency Fund",
        category_group_id: "group-2",
        category_group_name: "Savings Goals",
        hidden: false,
        deleted: false,
        note: null,
        budgeted: 50000,
        activity: 0,
        balance: 500000,
        goal_type: "TB",
        goal_percentage_complete: 50,
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
    it("should find categories by name", async () => {
      writeCache(testBudgetId, "categories.json", mockCategoriesCache);

      const result = await SearchCategoriesTool.execute({ query: "rent" }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.query).toBe("rent");
      expect(parsed.match_count).toBe(1);
      expect(parsed.auto_synced).toBe(false);
      expect(parsed.categories[0].name).toBe("Rent");
      expect(parsed.categories[0].id).toBe("cat-1");
    });

    it("should search case-insensitively", async () => {
      writeCache(testBudgetId, "categories.json", mockCategoriesCache);

      const result = await SearchCategoriesTool.execute({ query: "ELECTRIC" }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.match_count).toBe(1);
      expect(parsed.categories[0].name).toBe("Electric");
    });

    it("should search group names as well", async () => {
      writeCache(testBudgetId, "categories.json", mockCategoriesCache);

      const result = await SearchCategoriesTool.execute({ query: "savings" }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.match_count).toBe(1);
      expect(parsed.categories[0].name).toBe("Emergency Fund");
      expect(parsed.categories[0].group_name).toBe("Savings Goals");
    });

    it("should return multiple matches", async () => {
      writeCache(testBudgetId, "categories.json", mockCategoriesCache);

      const result = await SearchCategoriesTool.execute({ query: "bills" }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.match_count).toBe(2); // Rent and Electric in Bills group
    });

    it("should not return hidden categories", async () => {
      writeCache(testBudgetId, "categories.json", mockCategoriesCache);

      const result = await SearchCategoriesTool.execute({ query: "hidden" }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.match_count).toBe(0);
    });

    it("should return empty array for no matches", async () => {
      writeCache(testBudgetId, "categories.json", mockCategoriesCache);

      const result = await SearchCategoriesTool.execute({ query: "nonexistent" }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.match_count).toBe(0);
      expect(parsed.categories).toEqual([]);
    });

    it("should convert amounts from milliunits", async () => {
      writeCache(testBudgetId, "categories.json", mockCategoriesCache);

      const result = await SearchCategoriesTool.execute({ query: "rent" }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.categories[0].budgeted).toBe(150);
      expect(parsed.categories[0].activity).toBe(-150);
      expect(parsed.categories[0].balance).toBe(0);
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

      const result = await SearchCategoriesTool.execute({ query: "rent" }, mockApi as any);

      expect(mockApi.categories.getCategories).toHaveBeenCalled();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.auto_synced).toBe(true);
      expect(parsed.match_count).toBe(1);
    });

    it("should return error when no budget ID is available", async () => {
      delete process.env.YNAB_BUDGET_ID;

      const result = await SearchCategoriesTool.execute({ query: "test" }, mockApi as any);

      expect(result.content[0].text).toContain("Error searching categories:");
      expect(result.content[0].text).toContain("No budget ID provided");
    });
  });

  describe("tool configuration", () => {
    it("should have correct name", () => {
      expect(SearchCategoriesTool.name).toBe("search_categories");
    });

    it("should have correct description", () => {
      expect(SearchCategoriesTool.description).toContain("Search for categories");
      expect(SearchCategoriesTool.description).toContain("case-insensitive");
    });

    it("should have required query in schema", () => {
      expect(SearchCategoriesTool.inputSchema.query).toBeDefined();
    });
  });
});
