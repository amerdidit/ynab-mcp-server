import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import * as ynab from 'ynab';
import * as GetAccountTool from '../tools/GetAccountTool';

vi.mock('ynab');

describe('GetAccountTool', () => {
  let mockApi: {
    accounts: {
      getAccountById: Mock;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockApi = {
      accounts: {
        getAccountById: vi.fn(),
      },
    };

    (ynab.API as any).mockImplementation(() => mockApi);

    process.env.YNAB_API_TOKEN = 'test-token';
    process.env.YNAB_BUDGET_ID = 'default-budget-id';
  });

  describe('execute', () => {
    const mockAccountData = {
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
    };

    it('should successfully get an account by ID', async () => {
      mockApi.accounts.getAccountById.mockResolvedValue({
        data: { account: mockAccountData },
      });

      const result = await GetAccountTool.execute({ accountId: 'account-1' }, mockApi as any);

      expect(mockApi.accounts.getAccountById).toHaveBeenCalledWith('default-budget-id', 'account-1');

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe('account-1');
      expect(parsed.name).toBe('Checking');
      expect(parsed.type).toBe('checking');
      expect(parsed.on_budget).toBe(true);
      expect(parsed.balance).toBe(1500);
      expect(parsed.cleared_balance).toBe(1400);
      expect(parsed.uncleared_balance).toBe(100);
    });

    it('should use custom budget ID when provided', async () => {
      mockApi.accounts.getAccountById.mockResolvedValue({
        data: { account: mockAccountData },
      });

      await GetAccountTool.execute({ accountId: 'account-1', budgetId: 'custom-budget-id' }, mockApi as any);

      expect(mockApi.accounts.getAccountById).toHaveBeenCalledWith('custom-budget-id', 'account-1');
    });

    it('should return error when no budget ID is available', async () => {
      delete process.env.YNAB_BUDGET_ID;

      const result = await GetAccountTool.execute({ accountId: 'account-1' }, mockApi as any);

      expect(result.content[0].text).toContain('Error getting account:');
      expect(result.content[0].text).toContain('No budget ID provided');
      expect(mockApi.accounts.getAccountById).not.toHaveBeenCalled();
    });

    it('should return error when no account ID is provided', async () => {
      const result = await GetAccountTool.execute({ accountId: '' }, mockApi as any);

      expect(result.content[0].text).toContain('Error getting account:');
      expect(result.content[0].text).toContain('Account ID is required');
      expect(mockApi.accounts.getAccountById).not.toHaveBeenCalled();
    });

    it('should handle API error', async () => {
      const apiError = new Error('Account not found');
      mockApi.accounts.getAccountById.mockRejectedValue(apiError);

      const result = await GetAccountTool.execute({ accountId: 'invalid-id' }, mockApi as any);

      expect(result.content[0].text).toContain('Error getting account:');
      expect(result.content[0].text).toContain('Account not found');
    });

    it('should convert milliunits to dollars correctly', async () => {
      const accountWithPrecision = {
        ...mockAccountData,
        balance: 123450, // $123.45
        cleared_balance: 100000, // $100.00
        uncleared_balance: 23450, // $23.45
      };

      mockApi.accounts.getAccountById.mockResolvedValue({
        data: { account: accountWithPrecision },
      });

      const result = await GetAccountTool.execute({ accountId: 'account-1' }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.balance).toBe(123.45);
      expect(parsed.cleared_balance).toBe(100);
      expect(parsed.uncleared_balance).toBe(23.45);
    });

    it('should include all account details', async () => {
      mockApi.accounts.getAccountById.mockResolvedValue({
        data: { account: mockAccountData },
      });

      const result = await GetAccountTool.execute({ accountId: 'account-1' }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveProperty('id');
      expect(parsed).toHaveProperty('name');
      expect(parsed).toHaveProperty('type');
      expect(parsed).toHaveProperty('on_budget');
      expect(parsed).toHaveProperty('closed');
      expect(parsed).toHaveProperty('deleted');
      expect(parsed).toHaveProperty('balance');
      expect(parsed).toHaveProperty('cleared_balance');
      expect(parsed).toHaveProperty('uncleared_balance');
      expect(parsed).toHaveProperty('transfer_payee_id');
      expect(parsed).toHaveProperty('direct_import_linked');
      expect(parsed).toHaveProperty('direct_import_in_error');
    });

    it('should handle closed account', async () => {
      const closedAccount = {
        ...mockAccountData,
        closed: true,
      };

      mockApi.accounts.getAccountById.mockResolvedValue({
        data: { account: closedAccount },
      });

      const result = await GetAccountTool.execute({ accountId: 'account-1' }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.closed).toBe(true);
    });

    it('should handle negative balance (credit card)', async () => {
      const creditCardAccount = {
        ...mockAccountData,
        type: 'creditCard',
        balance: -250000, // -$250.00
        cleared_balance: -200000,
        uncleared_balance: -50000,
      };

      mockApi.accounts.getAccountById.mockResolvedValue({
        data: { account: creditCardAccount },
      });

      const result = await GetAccountTool.execute({ accountId: 'account-1' }, mockApi as any);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.balance).toBe(-250);
      expect(parsed.cleared_balance).toBe(-200);
      expect(parsed.uncleared_balance).toBe(-50);
    });
  });

  describe('tool configuration', () => {
    it('should have correct name', () => {
      expect(GetAccountTool.name).toBe('get_account');
    });

    it('should have correct description', () => {
      expect(GetAccountTool.description).toContain('single account');
      expect(GetAccountTool.description).toContain('by ID');
    });

    it('should have required accountId in schema', () => {
      expect(GetAccountTool.inputSchema.accountId).toBeDefined();
    });

    it('should have optional budgetId in schema', () => {
      expect(GetAccountTool.inputSchema.budgetId).toBeDefined();
    });
  });
});
