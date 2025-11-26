import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import * as ynab from 'ynab';
import * as ListAccountsTool from '../tools/ListAccountsTool';

vi.mock('ynab');

describe('ListAccountsTool', () => {
  let mockApi: {
    accounts: {
      getAccounts: Mock;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockApi = {
      accounts: {
        getAccounts: vi.fn(),
      },
    };

    (ynab.API as any).mockImplementation(() => mockApi);

    process.env.YNAB_API_TOKEN = 'test-token';
    process.env.YNAB_BUDGET_ID = 'default-budget-id';
  });

  describe('execute', () => {
    const mockAccountsData = [
      {
        id: 'account-1',
        name: 'Checking',
        type: 'checking',
        on_budget: true,
        closed: false,
        deleted: false,
        balance: 1500000, // $1500.00 in milliunits
        cleared_balance: 1400000,
        uncleared_balance: 100000,
        transfer_payee_id: 'transfer-1',
        direct_import_linked: true,
        direct_import_in_error: false,
      },
      {
        id: 'account-2',
        name: 'Savings',
        type: 'savings',
        on_budget: true,
        closed: false,
        deleted: false,
        balance: 5000000, // $5000.00 in milliunits
        cleared_balance: 5000000,
        uncleared_balance: 0,
        transfer_payee_id: 'transfer-2',
        direct_import_linked: false,
        direct_import_in_error: false,
      },
      {
        id: 'account-3',
        name: 'Credit Card',
        type: 'creditCard',
        on_budget: true,
        closed: false,
        deleted: false,
        balance: -250000, // -$250.00 in milliunits
        cleared_balance: -200000,
        uncleared_balance: -50000,
        transfer_payee_id: 'transfer-3',
        direct_import_linked: true,
        direct_import_in_error: false,
      },
    ];

    it('should successfully list all active accounts', async () => {
      mockApi.accounts.getAccounts.mockResolvedValue({
        data: { accounts: mockAccountsData },
      });

      const result = await ListAccountsTool.execute({}, mockApi as any);

      expect(mockApi.accounts.getAccounts).toHaveBeenCalledWith('default-budget-id');

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.account_count).toBe(3);
      expect(parsed.accounts).toHaveLength(3);
      expect(parsed.accounts[0]).toEqual({
        id: 'account-1',
        name: 'Checking',
        type: 'checking',
        on_budget: true,
        balance: 1500,
        cleared_balance: 1400,
        uncleared_balance: 100,
      });
    });

    it('should filter out deleted accounts', async () => {
      const accountsWithDeleted = [
        ...mockAccountsData,
        {
          id: 'account-deleted',
          name: 'Deleted Account',
          type: 'checking',
          on_budget: true,
          closed: false,
          deleted: true,
          balance: 0,
          cleared_balance: 0,
          uncleared_balance: 0,
          transfer_payee_id: 'transfer-deleted',
          direct_import_linked: false,
          direct_import_in_error: false,
        },
      ];

      mockApi.accounts.getAccounts.mockResolvedValue({
        data: { accounts: accountsWithDeleted },
      });

      const result = await ListAccountsTool.execute({}, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.account_count).toBe(3);
      expect(parsed.accounts.find((a: any) => a.id === 'account-deleted')).toBeUndefined();
    });

    it('should filter out closed accounts', async () => {
      const accountsWithClosed = [
        ...mockAccountsData,
        {
          id: 'account-closed',
          name: 'Closed Account',
          type: 'savings',
          on_budget: true,
          closed: true,
          deleted: false,
          balance: 0,
          cleared_balance: 0,
          uncleared_balance: 0,
          transfer_payee_id: 'transfer-closed',
          direct_import_linked: false,
          direct_import_in_error: false,
        },
      ];

      mockApi.accounts.getAccounts.mockResolvedValue({
        data: { accounts: accountsWithClosed },
      });

      const result = await ListAccountsTool.execute({}, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.account_count).toBe(3);
      expect(parsed.accounts.find((a: any) => a.id === 'account-closed')).toBeUndefined();
    });

    it('should use custom budget ID when provided', async () => {
      mockApi.accounts.getAccounts.mockResolvedValue({
        data: { accounts: mockAccountsData },
      });

      await ListAccountsTool.execute({ budgetId: 'custom-budget-id' }, mockApi as any);

      expect(mockApi.accounts.getAccounts).toHaveBeenCalledWith('custom-budget-id');
    });

    it('should handle empty account list', async () => {
      mockApi.accounts.getAccounts.mockResolvedValue({
        data: { accounts: [] },
      });

      const result = await ListAccountsTool.execute({}, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.account_count).toBe(0);
      expect(parsed.accounts).toEqual([]);
    });

    it('should return error when no budget ID is available', async () => {
      delete process.env.YNAB_BUDGET_ID;

      const result = await ListAccountsTool.execute({}, mockApi as any);

      expect(result.content[0].text).toContain('Error listing accounts:');
      expect(result.content[0].text).toContain('No budget ID provided');
      expect(mockApi.accounts.getAccounts).not.toHaveBeenCalled();
    });

    it('should handle API error', async () => {
      const apiError = new Error('API Error: Unauthorized');
      mockApi.accounts.getAccounts.mockRejectedValue(apiError);

      const result = await ListAccountsTool.execute({}, mockApi as any);

      expect(result.content[0].text).toContain('Error listing accounts:');
      expect(result.content[0].text).toContain('Unauthorized');
    });

    it('should convert milliunits to dollars correctly', async () => {
      const accountWithPrecision = [
        {
          id: 'account-precision',
          name: 'Precision Test',
          type: 'checking',
          on_budget: true,
          closed: false,
          deleted: false,
          balance: 123450, // $123.45
          cleared_balance: 100000, // $100.00
          uncleared_balance: 23450, // $23.45
          transfer_payee_id: 'transfer-precision',
          direct_import_linked: false,
          direct_import_in_error: false,
        },
      ];

      mockApi.accounts.getAccounts.mockResolvedValue({
        data: { accounts: accountWithPrecision },
      });

      const result = await ListAccountsTool.execute({}, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.accounts[0].balance).toBe(123.45);
      expect(parsed.accounts[0].cleared_balance).toBe(100);
      expect(parsed.accounts[0].uncleared_balance).toBe(23.45);
    });

    it('should include off-budget accounts', async () => {
      const accountsWithOffBudget = [
        {
          id: 'account-tracking',
          name: 'Investment Account',
          type: 'investmentAccount',
          on_budget: false,
          closed: false,
          deleted: false,
          balance: 10000000,
          cleared_balance: 10000000,
          uncleared_balance: 0,
          transfer_payee_id: 'transfer-tracking',
          direct_import_linked: false,
          direct_import_in_error: false,
        },
      ];

      mockApi.accounts.getAccounts.mockResolvedValue({
        data: { accounts: accountsWithOffBudget },
      });

      const result = await ListAccountsTool.execute({}, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.account_count).toBe(1);
      expect(parsed.accounts[0].on_budget).toBe(false);
    });
  });

  describe('tool configuration', () => {
    it('should have correct name', () => {
      expect(ListAccountsTool.name).toBe('list_accounts');
    });

    it('should have correct description', () => {
      expect(ListAccountsTool.description).toContain('Lists all accounts');
      expect(ListAccountsTool.description).toContain('account IDs');
    });

    it('should have optional budgetId in schema', () => {
      expect(ListAccountsTool.inputSchema.budgetId).toBeDefined();
    });
  });
});
