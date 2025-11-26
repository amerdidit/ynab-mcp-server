import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import * as ynab from 'ynab';
import * as DeleteTransactionTool from '../tools/DeleteTransactionTool';

vi.mock('ynab');

describe('DeleteTransactionTool', () => {
  let mockApi: {
    transactions: {
      deleteTransaction: Mock;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockApi = {
      transactions: {
        deleteTransaction: vi.fn(),
      },
    };

    (ynab.API as any).mockImplementation(() => mockApi);

    process.env.YNAB_API_TOKEN = 'test-token';
    process.env.YNAB_BUDGET_ID = 'test-budget-id';
  });

  describe('execute', () => {
    const mockDeletedTransaction = {
      id: 'transaction-123',
      account_id: 'account-123',
      date: '2023-01-01',
      amount: -50000,
      payee_name: 'Test Payee',
      category_id: 'category-123',
      memo: 'Test transaction',
      approved: true,
      cleared: ynab.TransactionClearedStatus.Cleared,
      deleted: true,
    };

    it('should successfully delete transaction with default budget ID', async () => {
      mockApi.transactions.deleteTransaction.mockResolvedValue({
        data: { transaction: mockDeletedTransaction },
      });

      const result = await DeleteTransactionTool.execute(
        { transactionId: 'transaction-123' },
        mockApi as any
      );

      expect(mockApi.transactions.deleteTransaction).toHaveBeenCalledWith(
        'test-budget-id',
        'transaction-123'
      );

      const expectedResult = {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            transactionId: 'transaction-123',
            message: "Transaction deleted successfully",
          }, null, 2)
        }]
      };

      expect(result).toEqual(expectedResult);
    });

    it('should successfully delete transaction with custom budget ID', async () => {
      mockApi.transactions.deleteTransaction.mockResolvedValue({
        data: { transaction: mockDeletedTransaction },
      });

      const result = await DeleteTransactionTool.execute(
        { budgetId: 'custom-budget-id', transactionId: 'transaction-123' },
        mockApi as any
      );

      expect(mockApi.transactions.deleteTransaction).toHaveBeenCalledWith(
        'custom-budget-id',
        'transaction-123'
      );

      const resultText = JSON.parse(result.content[0].text);
      expect(resultText.success).toBe(true);
      expect(resultText.transactionId).toBe('transaction-123');
    });

    it('should handle transaction not found error', async () => {
      const apiError = new Error('Transaction not found');
      mockApi.transactions.deleteTransaction.mockRejectedValue(apiError);

      const result = await DeleteTransactionTool.execute(
        { transactionId: 'nonexistent-transaction' },
        mockApi as any
      );

      expect(result.content[0].text).toContain('Error deleting transaction:');
      expect(result.content[0].text).toContain('Transaction not found');
    });

    it('should handle API error when deleting transaction', async () => {
      const apiError = new Error('Delete Transaction API Error: Unauthorized');
      mockApi.transactions.deleteTransaction.mockRejectedValue(apiError);

      const result = await DeleteTransactionTool.execute(
        { transactionId: 'transaction-123' },
        mockApi as any
      );

      expect(result.content[0].text).toContain('Error deleting transaction:');
      expect(result.content[0].text).toContain('Delete Transaction API Error: Unauthorized');
    });

    it('should handle missing transaction data in delete response', async () => {
      mockApi.transactions.deleteTransaction.mockResolvedValue({
        data: { transaction: null },
      });

      const result = await DeleteTransactionTool.execute(
        { transactionId: 'transaction-123' },
        mockApi as any
      );

      expect(result.content[0].text).toContain('Error deleting transaction:');
      expect(result.content[0].text).toContain('Failed to delete transaction - no transaction data returned');
    });

    it('should throw error when no budget ID is provided', async () => {
      delete process.env.YNAB_BUDGET_ID;

      const result = await DeleteTransactionTool.execute(
        { transactionId: 'transaction-123' },
        mockApi as any
      );

      expect(result.content[0].text).toContain('Error deleting transaction:');
      expect(result.content[0].text).toContain('No budget ID provided');
      expect(mockApi.transactions.deleteTransaction).not.toHaveBeenCalled();
    });

    it('should handle complex error objects', async () => {
      const complexError = {
        message: 'Transaction locked',
        code: 'TRANSACTION_LOCKED',
        detail: 'Transaction is part of a reconciled period',
      };

      mockApi.transactions.deleteTransaction.mockRejectedValue(complexError);

      const result = await DeleteTransactionTool.execute(
        { transactionId: 'transaction-123' },
        mockApi as any
      );

      expect(result.content[0].text).toContain('Error deleting transaction:');
      expect(result.content[0].text).toContain('Transaction locked');
    });
  });

  describe('tool configuration', () => {
    it('should have correct name and description', () => {
      expect(DeleteTransactionTool.name).toBe('delete_transaction');
      expect(DeleteTransactionTool.description).toContain('Deletes a transaction');
      expect(DeleteTransactionTool.description).toContain('cannot be undone');
    });

    it('should have correct input schema', () => {
      expect(DeleteTransactionTool.inputSchema).toHaveProperty('budgetId');
      expect(DeleteTransactionTool.inputSchema).toHaveProperty('transactionId');
    });
  });
});
