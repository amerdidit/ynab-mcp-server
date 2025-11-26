import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import * as ynab from 'ynab';
import * as ListCategoriesTool from '../tools/ListCategoriesTool';

vi.mock('ynab');

describe('ListCategoriesTool', () => {
  let mockApi: {
    categories: {
      getCategories: Mock;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockApi = {
      categories: {
        getCategories: vi.fn(),
      },
    };

    (ynab.API as any).mockImplementation(() => mockApi);

    process.env.YNAB_API_TOKEN = 'test-token';
    process.env.YNAB_BUDGET_ID = 'default-budget-id';
  });

  describe('execute', () => {
    const mockCategoryGroupsData = [
      {
        id: 'group-1',
        name: 'Bills',
        hidden: false,
        deleted: false,
        categories: [
          {
            id: 'cat-1',
            name: 'Rent',
            category_group_id: 'group-1',
            hidden: false,
            deleted: false,
            budgeted: 1500000, // $1500.00
            activity: -1500000,
            balance: 0,
            goal_type: 'MF',
            goal_percentage_complete: 100,
          },
          {
            id: 'cat-2',
            name: 'Utilities',
            category_group_id: 'group-1',
            hidden: false,
            deleted: false,
            budgeted: 200000, // $200.00
            activity: -150000,
            balance: 50000,
            goal_type: null,
            goal_percentage_complete: null,
          },
        ],
      },
      {
        id: 'group-2',
        name: 'Groceries',
        hidden: false,
        deleted: false,
        categories: [
          {
            id: 'cat-3',
            name: 'Food',
            category_group_id: 'group-2',
            hidden: false,
            deleted: false,
            budgeted: 500000, // $500.00
            activity: -300000,
            balance: 200000,
            goal_type: 'NEED',
            goal_percentage_complete: 60,
          },
        ],
      },
    ];

    it('should successfully list all categories', async () => {
      mockApi.categories.getCategories.mockResolvedValue({
        data: { category_groups: mockCategoryGroupsData },
      });

      const result = await ListCategoriesTool.execute({}, mockApi as any);

      expect(mockApi.categories.getCategories).toHaveBeenCalledWith('default-budget-id');

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.group_count).toBe(2);
      expect(parsed.category_count).toBe(3);
      expect(parsed.category_groups[0].name).toBe('Bills');
      expect(parsed.category_groups[0].categories).toHaveLength(2);
    });

    it('should filter out deleted category groups', async () => {
      const dataWithDeleted = [
        ...mockCategoryGroupsData,
        {
          id: 'group-deleted',
          name: 'Deleted Group',
          hidden: false,
          deleted: true,
          categories: [],
        },
      ];

      mockApi.categories.getCategories.mockResolvedValue({
        data: { category_groups: dataWithDeleted },
      });

      const result = await ListCategoriesTool.execute({}, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.group_count).toBe(2);
      expect(parsed.category_groups.find((g: any) => g.id === 'group-deleted')).toBeUndefined();
    });

    it('should filter out hidden category groups', async () => {
      const dataWithHidden = [
        ...mockCategoryGroupsData,
        {
          id: 'group-hidden',
          name: 'Hidden Group',
          hidden: true,
          deleted: false,
          categories: [],
        },
      ];

      mockApi.categories.getCategories.mockResolvedValue({
        data: { category_groups: dataWithHidden },
      });

      const result = await ListCategoriesTool.execute({}, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.group_count).toBe(2);
      expect(parsed.category_groups.find((g: any) => g.id === 'group-hidden')).toBeUndefined();
    });

    it('should filter out deleted categories', async () => {
      const dataWithDeletedCategory = [
        {
          ...mockCategoryGroupsData[0],
          categories: [
            ...mockCategoryGroupsData[0].categories,
            {
              id: 'cat-deleted',
              name: 'Deleted Category',
              category_group_id: 'group-1',
              hidden: false,
              deleted: true,
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
        data: { category_groups: dataWithDeletedCategory },
      });

      const result = await ListCategoriesTool.execute({}, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.category_groups[0].categories).toHaveLength(2);
      expect(parsed.category_groups[0].categories.find((c: any) => c.id === 'cat-deleted')).toBeUndefined();
    });

    it('should filter out hidden categories', async () => {
      const dataWithHiddenCategory = [
        {
          ...mockCategoryGroupsData[0],
          categories: [
            ...mockCategoryGroupsData[0].categories,
            {
              id: 'cat-hidden',
              name: 'Hidden Category',
              category_group_id: 'group-1',
              hidden: true,
              deleted: false,
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
        data: { category_groups: dataWithHiddenCategory },
      });

      const result = await ListCategoriesTool.execute({}, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.category_groups[0].categories).toHaveLength(2);
      expect(parsed.category_groups[0].categories.find((c: any) => c.id === 'cat-hidden')).toBeUndefined();
    });

    it('should use custom budget ID when provided', async () => {
      mockApi.categories.getCategories.mockResolvedValue({
        data: { category_groups: mockCategoryGroupsData },
      });

      await ListCategoriesTool.execute({ budgetId: 'custom-budget-id' }, mockApi as any);

      expect(mockApi.categories.getCategories).toHaveBeenCalledWith('custom-budget-id');
    });

    it('should handle empty category list', async () => {
      mockApi.categories.getCategories.mockResolvedValue({
        data: { category_groups: [] },
      });

      const result = await ListCategoriesTool.execute({}, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.group_count).toBe(0);
      expect(parsed.category_count).toBe(0);
      expect(parsed.category_groups).toEqual([]);
    });

    it('should return error when no budget ID is available', async () => {
      delete process.env.YNAB_BUDGET_ID;

      const result = await ListCategoriesTool.execute({}, mockApi as any);

      expect(result.content[0].text).toContain('Error listing categories:');
      expect(result.content[0].text).toContain('No budget ID provided');
      expect(mockApi.categories.getCategories).not.toHaveBeenCalled();
    });

    it('should handle API error', async () => {
      const apiError = new Error('API Error: Unauthorized');
      mockApi.categories.getCategories.mockRejectedValue(apiError);

      const result = await ListCategoriesTool.execute({}, mockApi as any);

      expect(result.content[0].text).toContain('Error listing categories:');
      expect(result.content[0].text).toContain('Unauthorized');
    });

    it('should convert milliunits to dollars correctly', async () => {
      mockApi.categories.getCategories.mockResolvedValue({
        data: { category_groups: mockCategoryGroupsData },
      });

      const result = await ListCategoriesTool.execute({}, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      const rentCategory = parsed.category_groups[0].categories[0];
      expect(rentCategory.budgeted).toBe(1500);
      expect(rentCategory.activity).toBe(-1500);
      expect(rentCategory.balance).toBe(0);
    });

    it('should include goal information', async () => {
      mockApi.categories.getCategories.mockResolvedValue({
        data: { category_groups: mockCategoryGroupsData },
      });

      const result = await ListCategoriesTool.execute({}, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      const rentCategory = parsed.category_groups[0].categories[0];
      expect(rentCategory.goal_type).toBe('MF');
      expect(rentCategory.goal_percentage_complete).toBe(100);

      const utilitiesCategory = parsed.category_groups[0].categories[1];
      expect(utilitiesCategory.goal_type).toBeNull();
      expect(utilitiesCategory.goal_percentage_complete).toBeNull();
    });
  });

  describe('tool configuration', () => {
    it('should have correct name', () => {
      expect(ListCategoriesTool.name).toBe('list_categories');
    });

    it('should have correct description', () => {
      expect(ListCategoriesTool.description).toContain('categories');
      expect(ListCategoriesTool.description).toContain('category IDs');
    });

    it('should have optional budgetId in schema', () => {
      expect(ListCategoriesTool.inputSchema.budgetId).toBeDefined();
    });
  });
});
