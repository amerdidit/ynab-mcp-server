import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import * as ynab from 'ynab';
import * as SearchTransactionsTool from '../tools/SearchTransactionsTool';

vi.mock('ynab');

describe('SearchTransactionsTool', () => {
  let mockApi: {
    transactions: {
      getTransactions: Mock;
    };
    accounts: {
      getAccounts: Mock;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockApi = {
      transactions: {
        getTransactions: vi.fn(),
      },
      accounts: {
        getAccounts: vi.fn(),
      },
    };

    (ynab.API as any).mockImplementation(() => mockApi);

    process.env.YNAB_API_TOKEN = 'test-token';
    process.env.YNAB_BUDGET_ID = 'test-budget-id';
  });

  const mockTransactionsData = [
    {
      id: 'transaction-1',
      date: '2024-01-15',
      amount: -50000, // -$50.00
      memo: 'Grocery shopping at Whole Foods',
      approved: true,
      cleared: 'cleared',
      account_id: 'account-1',
      account_name: 'Checking',
      payee_id: 'payee-1',
      payee_name: 'Whole Foods',
      category_id: 'category-1',
      category_name: 'Groceries',
      flag_color: null,
      transfer_account_id: null,
      deleted: false,
      subtransactions: [],
    },
    {
      id: 'transaction-2',
      date: '2024-01-20',
      amount: -25500, // -$25.50
      memo: 'Lunch with team',
      approved: false,
      cleared: 'uncleared',
      account_id: 'account-2',
      account_name: 'Credit Card',
      payee_id: 'payee-2',
      payee_name: 'Restaurant ABC',
      category_id: 'category-2',
      category_name: 'Dining Out',
      flag_color: 'red',
      transfer_account_id: null,
      deleted: false,
      subtransactions: [],
    },
    {
      id: 'transaction-3',
      date: '2024-02-01',
      amount: 150000, // +$150.00 (inflow)
      memo: 'Refund from Amazon',
      approved: true,
      cleared: 'reconciled',
      account_id: 'account-1',
      account_name: 'Checking',
      payee_id: 'payee-3',
      payee_name: 'Amazon',
      category_id: 'category-3',
      category_name: 'Shopping',
      flag_color: 'green',
      transfer_account_id: null,
      deleted: false,
      subtransactions: [],
    },
    {
      id: 'transaction-4',
      date: '2024-02-10',
      amount: -100000, // -$100.00
      memo: null,
      approved: true,
      cleared: 'cleared',
      account_id: 'account-1',
      account_name: 'Checking',
      payee_id: 'payee-1',
      payee_name: 'Whole Foods',
      category_id: 'category-1',
      category_name: 'Groceries',
      flag_color: null,
      transfer_account_id: null,
      deleted: false,
      subtransactions: [],
    },
    {
      id: 'transaction-deleted',
      date: '2024-01-25',
      amount: -10000,
      memo: 'Deleted transaction',
      approved: false,
      cleared: 'uncleared',
      account_id: 'account-1',
      account_name: 'Checking',
      payee_id: 'payee-1',
      payee_name: 'Test',
      category_id: 'category-1',
      category_name: 'Test',
      flag_color: null,
      transfer_account_id: null,
      deleted: true,
      subtransactions: [],
    },
  ];

  describe('execute', () => {
    it('should search transactions with only sinceDate', async () => {
      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: mockTransactionsData },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01' },
        mockApi as any
      );

      expect(mockApi.transactions.getTransactions).toHaveBeenCalledWith(
        'test-budget-id',
        '2024-01-01',
        undefined
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(4); // Excludes deleted
      expect(parsed.filters_applied.since_date).toBe('2024-01-01');
    });

    it('should filter by beforeDate', async () => {
      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: mockTransactionsData },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01', beforeDate: '2024-02-01' },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(2); // Only Jan transactions
      expect(parsed.transactions.every((t: any) => t.date < '2024-02-01')).toBe(true);
    });

    it('should filter by accountId', async () => {
      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: mockTransactionsData },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01', accountId: 'account-1' },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(3);
      expect(parsed.transactions.every((t: any) => t.account_id === 'account-1')).toBe(true);
    });

    it('should filter by categoryId', async () => {
      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: mockTransactionsData },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01', categoryId: 'category-1' },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(2);
      expect(parsed.transactions.every((t: any) => t.category_id === 'category-1')).toBe(true);
    });

    it('should filter by categoryId including split transactions', async () => {
      const transactionsWithSplit = [
        ...mockTransactionsData,
        {
          id: 'split-transaction',
          date: '2024-01-18',
          amount: -75000,
          memo: 'Split purchase',
          approved: true,
          cleared: 'cleared',
          account_id: 'account-1',
          account_name: 'Checking',
          payee_id: 'payee-4',
          payee_name: 'Target',
          category_id: null, // Split transactions have null category
          category_name: 'Split',
          flag_color: null,
          transfer_account_id: null,
          deleted: false,
          subtransactions: [
            { category_id: 'category-1', amount: -50000 },
            { category_id: 'category-2', amount: -25000 },
          ],
        },
      ];

      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: transactionsWithSplit },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01', categoryId: 'category-1' },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(3); // 2 regular + 1 split
      expect(parsed.transactions.some((t: any) => t.id === 'split-transaction')).toBe(true);
    });

    it('should filter for uncategorized transactions using API type parameter', async () => {
      const uncategorizedTransactions = [
        {
          id: 'uncategorized-1',
          date: '2024-01-15',
          amount: -30000,
          memo: 'Uncategorized expense',
          approved: false,
          cleared: 'uncleared',
          account_id: 'account-1',
          account_name: 'Checking',
          payee_id: 'payee-5',
          payee_name: 'Unknown Store',
          category_id: null,
          category_name: 'Uncategorized',
          flag_color: null,
          transfer_account_id: null,
          deleted: false,
          subtransactions: [],
        },
        {
          id: 'uncategorized-2',
          date: '2024-01-20',
          amount: -15000,
          memo: null,
          approved: true,
          cleared: 'cleared',
          account_id: 'account-2',
          account_name: 'Credit Card',
          payee_id: 'payee-6',
          payee_name: 'Random Merchant',
          category_id: null,
          category_name: 'Uncategorized',
          flag_color: null,
          transfer_account_id: null,
          deleted: false,
          subtransactions: [],
        },
      ];

      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: uncategorizedTransactions },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01', categoryId: 'uncategorized' },
        mockApi as any
      );

      // Verify API was called with type: "uncategorized"
      expect(mockApi.transactions.getTransactions).toHaveBeenCalledWith(
        'test-budget-id',
        '2024-01-01',
        'uncategorized'
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(2);
      expect(parsed.transactions.every((t: any) => t.category_id === null)).toBe(true);
      expect(parsed.filters_applied.category_id).toBe('uncategorized');
    });

    it('should handle "UNCATEGORIZED" case-insensitively', async () => {
      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: [] },
      });

      await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01', categoryId: 'UNCATEGORIZED' },
        mockApi as any
      );

      expect(mockApi.transactions.getTransactions).toHaveBeenCalledWith(
        'test-budget-id',
        '2024-01-01',
        'uncategorized'
      );
    });

    it('should filter by payeeId', async () => {
      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: mockTransactionsData },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01', payeeId: 'payee-1' },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(2);
      expect(parsed.transactions.every((t: any) => t.payee_id === 'payee-1')).toBe(true);
    });

    it('should filter by minAmount', async () => {
      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: mockTransactionsData },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01', minAmount: 0 },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(1); // Only the inflow
      expect(parsed.transactions[0].id).toBe('transaction-3');
    });

    it('should filter by maxAmount', async () => {
      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: mockTransactionsData },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01', maxAmount: -50 },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(2); // -$100 and -$50
      expect(parsed.transactions.every((t: any) => parseFloat(t.amount) <= -50)).toBe(true);
    });

    it('should filter by amount range', async () => {
      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: mockTransactionsData },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01', minAmount: -60, maxAmount: -20 },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(2); // -$50 and -$25.50
    });

    it('should filter by memo text (case-insensitive)', async () => {
      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: mockTransactionsData },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01', memo: 'GROCERY' },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(1);
      expect(parsed.transactions[0].memo).toContain('Grocery');
    });

    it('should filter by payeeName text (case-insensitive)', async () => {
      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: mockTransactionsData },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01', payeeName: 'whole' },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(2);
      expect(parsed.transactions.every((t: any) => t.payee_name.toLowerCase().includes('whole'))).toBe(true);
    });

    it('should filter by cleared status', async () => {
      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: mockTransactionsData },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01', cleared: 'uncleared' },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(1);
      expect(parsed.transactions[0].cleared).toBe('uncleared');
    });

    it('should filter by approved status', async () => {
      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: mockTransactionsData },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01', approved: false },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(1);
      expect(parsed.transactions[0].approved).toBe(false);
    });

    it('should filter by flagColor', async () => {
      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: mockTransactionsData },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01', flagColor: 'red' },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(1);
      expect(parsed.transactions[0].flag_color).toBe('red');
    });

    it('should exclude budget-to-budget transfers when excludeBudgetTransfers is true', async () => {
      const transactionsWithTransfers = [
        {
          id: 'regular-1',
          date: '2024-01-15',
          amount: -50000,
          memo: 'Regular purchase',
          approved: true,
          cleared: 'cleared',
          account_id: 'checking-id',
          account_name: 'Checking',
          payee_id: 'payee-1',
          payee_name: 'Store',
          category_id: null,
          category_name: null,
          flag_color: null,
          transfer_account_id: null,
          deleted: false,
          subtransactions: [],
        },
        {
          id: 'budget-transfer',
          date: '2024-01-15',
          amount: -100000,
          memo: 'Transfer to Savings',
          approved: true,
          cleared: 'cleared',
          account_id: 'checking-id',
          account_name: 'Checking',
          payee_id: 'transfer-payee',
          payee_name: 'Transfer : Savings',
          category_id: null,
          category_name: null,
          flag_color: null,
          transfer_account_id: 'savings-id',
          deleted: false,
          subtransactions: [],
        },
        {
          id: 'tracking-transfer',
          date: '2024-01-15',
          amount: -50000,
          memo: 'Investment contribution',
          approved: true,
          cleared: 'cleared',
          account_id: 'checking-id',
          account_name: 'Checking',
          payee_id: 'investment-payee',
          payee_name: 'Transfer : Investment',
          category_id: null,
          category_name: null,
          flag_color: null,
          transfer_account_id: 'investment-id',
          deleted: false,
          subtransactions: [],
        },
      ];

      const mockAccounts = [
        { id: 'checking-id', name: 'Checking', on_budget: true },
        { id: 'savings-id', name: 'Savings', on_budget: true },
        { id: 'investment-id', name: 'Investment', on_budget: false }, // tracking account
      ];

      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: transactionsWithTransfers },
      });
      mockApi.accounts.getAccounts.mockResolvedValue({
        data: { accounts: mockAccounts },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01', excludeBudgetTransfers: true },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(2);
      expect(parsed.transactions.map((t: any) => t.id)).toContain('regular-1');
      expect(parsed.transactions.map((t: any) => t.id)).toContain('tracking-transfer');
      expect(parsed.transactions.map((t: any) => t.id)).not.toContain('budget-transfer');
      expect(parsed.filters_applied.exclude_budget_transfers).toBe(true);
    });

    it('should include all transfers by default', async () => {
      const transactionsWithTransfer = [
        {
          id: 'regular-1',
          date: '2024-01-15',
          amount: -50000,
          memo: 'Regular purchase',
          approved: true,
          cleared: 'cleared',
          account_id: 'checking-id',
          account_name: 'Checking',
          payee_id: 'payee-1',
          payee_name: 'Store',
          category_id: null,
          category_name: null,
          flag_color: null,
          transfer_account_id: null,
          deleted: false,
          subtransactions: [],
        },
        {
          id: 'transfer-1',
          date: '2024-01-15',
          amount: -100000,
          memo: 'Transfer to Savings',
          approved: true,
          cleared: 'cleared',
          account_id: 'checking-id',
          account_name: 'Checking',
          payee_id: 'transfer-payee',
          payee_name: 'Transfer : Savings',
          category_id: null,
          category_name: null,
          flag_color: null,
          transfer_account_id: 'savings-id',
          deleted: false,
          subtransactions: [],
        },
      ];

      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: transactionsWithTransfer },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01' },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(2);
      // Should NOT call getAccounts when filter is not used
      expect(mockApi.accounts.getAccounts).not.toHaveBeenCalled();
    });

    it('should keep transfers from tracking to budget accounts', async () => {
      const transactionsWithTransfers = [
        {
          id: 'tracking-to-budget',
          date: '2024-01-15',
          amount: 50000,
          memo: 'Dividend income',
          approved: true,
          cleared: 'cleared',
          account_id: 'investment-id', // tracking account
          account_name: 'Investment',
          payee_id: 'transfer-payee',
          payee_name: 'Transfer : Checking',
          category_id: null,
          category_name: null,
          flag_color: null,
          transfer_account_id: 'checking-id', // budget account
          deleted: false,
          subtransactions: [],
        },
      ];

      const mockAccounts = [
        { id: 'checking-id', name: 'Checking', on_budget: true },
        { id: 'investment-id', name: 'Investment', on_budget: false },
      ];

      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: transactionsWithTransfers },
      });
      mockApi.accounts.getAccounts.mockResolvedValue({
        data: { accounts: mockAccounts },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01', excludeBudgetTransfers: true },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(1);
      expect(parsed.transactions[0].id).toBe('tracking-to-budget');
    });

    it('should apply multiple filters together', async () => {
      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: mockTransactionsData },
      });

      const result = await SearchTransactionsTool.execute(
        {
          sinceDate: '2024-01-01',
          accountId: 'account-1',
          approved: true,
          cleared: 'cleared',
        },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(2);
      expect(parsed.filters_applied).toEqual({
        since_date: '2024-01-01',
        account_id: 'account-1',
        approved: true,
        cleared: 'cleared',
      });
    });

    it('should respect the limit parameter', async () => {
      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: mockTransactionsData },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01', limit: 2 },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(2);
      expect(parsed.total_matching).toBe(4);
    });

    it('should default limit to 100', async () => {
      const manyTransactions = Array.from({ length: 150 }, (_, i) => ({
        id: `transaction-${i}`,
        date: '2024-01-15',
        amount: -10000,
        memo: `Transaction ${i}`,
        approved: true,
        cleared: 'cleared',
        account_id: 'account-1',
        account_name: 'Checking',
        payee_id: 'payee-1',
        payee_name: 'Test',
        category_id: 'category-1',
        category_name: 'Test',
        flag_color: null,
        transfer_account_id: null,
        deleted: false,
        subtransactions: [],
      }));

      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: manyTransactions },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01' },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(100);
      expect(parsed.total_matching).toBe(150);
    });

    it('should handle empty results', async () => {
      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: [] },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01' },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_count).toBe(0);
      expect(parsed.transactions).toEqual([]);
    });

    it('should handle null memo gracefully', async () => {
      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: mockTransactionsData },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01', memo: 'test' },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      // Should not crash, should just filter out transactions with null memo
      expect(parsed.transactions.every((t: any) => t.memo !== null)).toBe(true);
    });

    it('should use provided budgetId over environment variable', async () => {
      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: [] },
      });

      await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01', budgetId: 'custom-budget-id' },
        mockApi as any
      );

      expect(mockApi.transactions.getTransactions).toHaveBeenCalledWith(
        'custom-budget-id',
        '2024-01-01',
        undefined
      );
    });

    it('should handle API errors', async () => {
      mockApi.transactions.getTransactions.mockRejectedValue(
        new Error('API Error: Rate limited')
      );

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01' },
        mockApi as any
      );

      expect(result.content[0].text).toContain('Error searching transactions:');
      expect(result.content[0].text).toContain('Rate limited');
    });

    it('should throw error when no budget ID is available', async () => {
      delete process.env.YNAB_BUDGET_ID;

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01' },
        mockApi as any
      );

      expect(result.content[0].text).toContain('Error searching transactions:');
      expect(result.content[0].text).toContain('No budget ID provided');
    });

    it('should convert milliunits to dollars correctly', async () => {
      mockApi.transactions.getTransactions.mockResolvedValue({
        data: { transactions: mockTransactionsData },
      });

      const result = await SearchTransactionsTool.execute(
        { sinceDate: '2024-01-01' },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      const transaction1 = parsed.transactions.find((t: any) => t.id === 'transaction-1');
      const transaction2 = parsed.transactions.find((t: any) => t.id === 'transaction-2');
      const transaction3 = parsed.transactions.find((t: any) => t.id === 'transaction-3');

      expect(transaction1.amount).toBe('-50.00');
      expect(transaction2.amount).toBe('-25.50');
      expect(transaction3.amount).toBe('150.00');
    });
  });

  describe('tool configuration', () => {
    it('should have correct name', () => {
      expect(SearchTransactionsTool.name).toBe('search_transactions');
    });

    it('should have descriptive description with amount examples', () => {
      expect(SearchTransactionsTool.description).toContain('Search');
      expect(SearchTransactionsTool.description).toContain('sinceDate');
      expect(SearchTransactionsTool.description).toContain('Amount examples');
    });

    it('should have required sinceDate in input schema', () => {
      expect(SearchTransactionsTool.inputSchema).toHaveProperty('sinceDate');
    });

    it('should have all filter options in input schema', () => {
      const schema = SearchTransactionsTool.inputSchema;
      expect(schema).toHaveProperty('budgetId');
      expect(schema).toHaveProperty('sinceDate');
      expect(schema).toHaveProperty('beforeDate');
      expect(schema).toHaveProperty('accountId');
      expect(schema).toHaveProperty('categoryId');
      expect(schema).toHaveProperty('payeeId');
      expect(schema).toHaveProperty('minAmount');
      expect(schema).toHaveProperty('maxAmount');
      expect(schema).toHaveProperty('memo');
      expect(schema).toHaveProperty('payeeName');
      expect(schema).toHaveProperty('cleared');
      expect(schema).toHaveProperty('approved');
      expect(schema).toHaveProperty('flagColor');
      expect(schema).toHaveProperty('limit');
    });
  });
});
