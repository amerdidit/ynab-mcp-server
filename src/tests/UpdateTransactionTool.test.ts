import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import * as ynab from 'ynab';
import * as UpdateTransactionTool from '../tools/UpdateTransactionTool';

vi.mock('ynab');

describe('UpdateTransactionTool', () => {
  let mockApi: {
    transactions: {
      updateTransaction: Mock;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockApi = {
      transactions: {
        updateTransaction: vi.fn(),
      },
    };

    (ynab.API as any).mockImplementation(() => mockApi);

    process.env.YNAB_API_TOKEN = 'test-token';
    process.env.YNAB_BUDGET_ID = 'test-budget-id';
  });

  describe('execute', () => {
    const mockUpdatedTransaction = {
      id: 'transaction-123',
      account_id: 'account-123',
      date: '2023-01-01',
      amount: -50000,
      payee_name: 'Test Payee',
      category_id: 'category-123',
      memo: 'Updated memo',
      approved: true,
      cleared: ynab.TransactionClearedStatus.Cleared,
    };

    it('should successfully update transaction memo', async () => {
      mockApi.transactions.updateTransaction.mockResolvedValue({
        data: { transaction: mockUpdatedTransaction },
      });

      const result = await UpdateTransactionTool.execute(
        { transactionId: 'transaction-123', memo: 'Updated memo' },
        mockApi as any
      );

      expect(mockApi.transactions.updateTransaction).toHaveBeenCalledWith(
        'test-budget-id',
        'transaction-123',
        {
          transaction: {
            memo: 'Updated memo',
          },
        }
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.transactionId).toBe('transaction-123');
    });

    it('should successfully update transaction category', async () => {
      mockApi.transactions.updateTransaction.mockResolvedValue({
        data: { transaction: mockUpdatedTransaction },
      });

      const result = await UpdateTransactionTool.execute(
        { transactionId: 'transaction-123', categoryId: 'new-category-id' },
        mockApi as any
      );

      expect(mockApi.transactions.updateTransaction).toHaveBeenCalledWith(
        'test-budget-id',
        'transaction-123',
        {
          transaction: {
            category_id: 'new-category-id',
          },
        }
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
    });

    it('should convert amount from dollars to milliunits', async () => {
      mockApi.transactions.updateTransaction.mockResolvedValue({
        data: { transaction: mockUpdatedTransaction },
      });

      await UpdateTransactionTool.execute(
        { transactionId: 'transaction-123', amount: -50.99 },
        mockApi as any
      );

      expect(mockApi.transactions.updateTransaction).toHaveBeenCalledWith(
        'test-budget-id',
        'transaction-123',
        {
          transaction: {
            amount: -50990,
          },
        }
      );
    });

    it('should handle positive amounts (inflows)', async () => {
      mockApi.transactions.updateTransaction.mockResolvedValue({
        data: { transaction: mockUpdatedTransaction },
      });

      await UpdateTransactionTool.execute(
        { transactionId: 'transaction-123', amount: 100.50 },
        mockApi as any
      );

      expect(mockApi.transactions.updateTransaction).toHaveBeenCalledWith(
        'test-budget-id',
        'transaction-123',
        {
          transaction: {
            amount: 100500,
          },
        }
      );
    });

    it('should convert cleared status to enum', async () => {
      mockApi.transactions.updateTransaction.mockResolvedValue({
        data: { transaction: mockUpdatedTransaction },
      });

      await UpdateTransactionTool.execute(
        { transactionId: 'transaction-123', cleared: true },
        mockApi as any
      );

      expect(mockApi.transactions.updateTransaction).toHaveBeenCalledWith(
        'test-budget-id',
        'transaction-123',
        {
          transaction: {
            cleared: ynab.TransactionClearedStatus.Cleared,
          },
        }
      );
    });

    it('should convert cleared=false to Uncleared status', async () => {
      mockApi.transactions.updateTransaction.mockResolvedValue({
        data: { transaction: mockUpdatedTransaction },
      });

      await UpdateTransactionTool.execute(
        { transactionId: 'transaction-123', cleared: false },
        mockApi as any
      );

      expect(mockApi.transactions.updateTransaction).toHaveBeenCalledWith(
        'test-budget-id',
        'transaction-123',
        {
          transaction: {
            cleared: ynab.TransactionClearedStatus.Uncleared,
          },
        }
      );
    });

    it('should update multiple fields at once', async () => {
      mockApi.transactions.updateTransaction.mockResolvedValue({
        data: { transaction: mockUpdatedTransaction },
      });

      await UpdateTransactionTool.execute(
        {
          transactionId: 'transaction-123',
          memo: 'New memo',
          categoryId: 'new-category',
          amount: -25.00,
          approved: true,
        },
        mockApi as any
      );

      expect(mockApi.transactions.updateTransaction).toHaveBeenCalledWith(
        'test-budget-id',
        'transaction-123',
        {
          transaction: {
            memo: 'New memo',
            category_id: 'new-category',
            amount: -25000,
            approved: true,
          },
        }
      );
    });

    it('should use custom budget ID when provided', async () => {
      mockApi.transactions.updateTransaction.mockResolvedValue({
        data: { transaction: mockUpdatedTransaction },
      });

      await UpdateTransactionTool.execute(
        { budgetId: 'custom-budget-id', transactionId: 'transaction-123', memo: 'Test' },
        mockApi as any
      );

      expect(mockApi.transactions.updateTransaction).toHaveBeenCalledWith(
        'custom-budget-id',
        'transaction-123',
        expect.any(Object)
      );
    });

    it('should update payee by ID', async () => {
      mockApi.transactions.updateTransaction.mockResolvedValue({
        data: { transaction: mockUpdatedTransaction },
      });

      await UpdateTransactionTool.execute(
        { transactionId: 'transaction-123', payeeId: 'new-payee-id' },
        mockApi as any
      );

      expect(mockApi.transactions.updateTransaction).toHaveBeenCalledWith(
        'test-budget-id',
        'transaction-123',
        {
          transaction: {
            payee_id: 'new-payee-id',
          },
        }
      );
    });

    it('should update payee by name', async () => {
      mockApi.transactions.updateTransaction.mockResolvedValue({
        data: { transaction: mockUpdatedTransaction },
      });

      await UpdateTransactionTool.execute(
        { transactionId: 'transaction-123', payeeName: 'New Payee Name' },
        mockApi as any
      );

      expect(mockApi.transactions.updateTransaction).toHaveBeenCalledWith(
        'test-budget-id',
        'transaction-123',
        {
          transaction: {
            payee_name: 'New Payee Name',
          },
        }
      );
    });

    it('should update transaction date', async () => {
      mockApi.transactions.updateTransaction.mockResolvedValue({
        data: { transaction: mockUpdatedTransaction },
      });

      await UpdateTransactionTool.execute(
        { transactionId: 'transaction-123', date: '2024-06-15' },
        mockApi as any
      );

      expect(mockApi.transactions.updateTransaction).toHaveBeenCalledWith(
        'test-budget-id',
        'transaction-123',
        {
          transaction: {
            date: '2024-06-15',
          },
        }
      );
    });

    it('should update account ID', async () => {
      mockApi.transactions.updateTransaction.mockResolvedValue({
        data: { transaction: mockUpdatedTransaction },
      });

      await UpdateTransactionTool.execute(
        { transactionId: 'transaction-123', accountId: 'new-account-id' },
        mockApi as any
      );

      expect(mockApi.transactions.updateTransaction).toHaveBeenCalledWith(
        'test-budget-id',
        'transaction-123',
        {
          transaction: {
            account_id: 'new-account-id',
          },
        }
      );
    });

    it('should update flag color', async () => {
      mockApi.transactions.updateTransaction.mockResolvedValue({
        data: { transaction: mockUpdatedTransaction },
      });

      await UpdateTransactionTool.execute(
        { transactionId: 'transaction-123', flagColor: 'red' },
        mockApi as any
      );

      expect(mockApi.transactions.updateTransaction).toHaveBeenCalledWith(
        'test-budget-id',
        'transaction-123',
        {
          transaction: {
            flag_color: 'red',
          },
        }
      );
    });

    it('should remove flag color when set to null', async () => {
      mockApi.transactions.updateTransaction.mockResolvedValue({
        data: { transaction: mockUpdatedTransaction },
      });

      await UpdateTransactionTool.execute(
        { transactionId: 'transaction-123', flagColor: null },
        mockApi as any
      );

      expect(mockApi.transactions.updateTransaction).toHaveBeenCalledWith(
        'test-budget-id',
        'transaction-123',
        {
          transaction: {
            flag_color: null,
          },
        }
      );
    });

    it('should return error when no fields to update are provided', async () => {
      const result = await UpdateTransactionTool.execute(
        { transactionId: 'transaction-123' },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('No fields to update');
      expect(mockApi.transactions.updateTransaction).not.toHaveBeenCalled();
    });

    it('should return error when no budget ID is available', async () => {
      delete process.env.YNAB_BUDGET_ID;

      const result = await UpdateTransactionTool.execute(
        { transactionId: 'transaction-123', memo: 'Test' },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('No budget ID provided');
      expect(mockApi.transactions.updateTransaction).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('API Error: Transaction not found');
      mockApi.transactions.updateTransaction.mockRejectedValue(apiError);

      const result = await UpdateTransactionTool.execute(
        { transactionId: 'nonexistent', memo: 'Test' },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('API Error: Transaction not found');
    });

    it('should handle missing transaction data in response', async () => {
      mockApi.transactions.updateTransaction.mockResolvedValue({
        data: { transaction: null },
      });

      const result = await UpdateTransactionTool.execute(
        { transactionId: 'transaction-123', memo: 'Test' },
        mockApi as any
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Failed to update transaction');
    });

    it('should update approved status', async () => {
      mockApi.transactions.updateTransaction.mockResolvedValue({
        data: { transaction: mockUpdatedTransaction },
      });

      await UpdateTransactionTool.execute(
        { transactionId: 'transaction-123', approved: true },
        mockApi as any
      );

      expect(mockApi.transactions.updateTransaction).toHaveBeenCalledWith(
        'test-budget-id',
        'transaction-123',
        {
          transaction: {
            approved: true,
          },
        }
      );
    });

    it('should unapprove transaction', async () => {
      mockApi.transactions.updateTransaction.mockResolvedValue({
        data: { transaction: mockUpdatedTransaction },
      });

      await UpdateTransactionTool.execute(
        { transactionId: 'transaction-123', approved: false },
        mockApi as any
      );

      expect(mockApi.transactions.updateTransaction).toHaveBeenCalledWith(
        'test-budget-id',
        'transaction-123',
        {
          transaction: {
            approved: false,
          },
        }
      );
    });
  });

  describe('tool configuration', () => {
    it('should have correct name and description', () => {
      expect(UpdateTransactionTool.name).toBe('update_transaction');
      expect(UpdateTransactionTool.description).toContain('Updates an existing transaction');
    });

    it('should have correct input schema', () => {
      expect(UpdateTransactionTool.inputSchema).toHaveProperty('budgetId');
      expect(UpdateTransactionTool.inputSchema).toHaveProperty('transactionId');
      expect(UpdateTransactionTool.inputSchema).toHaveProperty('accountId');
      expect(UpdateTransactionTool.inputSchema).toHaveProperty('date');
      expect(UpdateTransactionTool.inputSchema).toHaveProperty('amount');
      expect(UpdateTransactionTool.inputSchema).toHaveProperty('payeeId');
      expect(UpdateTransactionTool.inputSchema).toHaveProperty('payeeName');
      expect(UpdateTransactionTool.inputSchema).toHaveProperty('categoryId');
      expect(UpdateTransactionTool.inputSchema).toHaveProperty('memo');
      expect(UpdateTransactionTool.inputSchema).toHaveProperty('cleared');
      expect(UpdateTransactionTool.inputSchema).toHaveProperty('approved');
      expect(UpdateTransactionTool.inputSchema).toHaveProperty('flagColor');
    });
  });
});
