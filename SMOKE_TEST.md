# Smoke Testing Checklist - Split Transactions

Manual verification checklist for split transaction functionality against a real YNAB budget.

## Prerequisites

- [ ] YNAB API token configured (`YNAB_API_TOKEN`)
- [ ] Test budget ID available (use `Test Budget`: `c38a323c-ea58-4ca6-b3aa-dce8bdc80cc3`)
- [ ] MCP server running and connected to client

## Test Data Setup

Before testing, identify:
- **Account ID**: Run `list_accounts` to get a valid account ID
- **Category IDs**: Run `list_categories` to get 2-3 category IDs for splits

---

## 1. Create Split Transaction

### 1.1 Basic Split (2 categories)
```json
{
  "budgetId": "c38a323c-ea58-4ca6-b3aa-dce8bdc80cc3",
  "accountId": "<account-id>",
  "date": "2024-01-15",
  "amount": -75.00,
  "payeeName": "Test Split Payee",
  "memo": "Smoke test - 2 way split",
  "subtransactions": [
    {"amount": -50.00, "categoryId": "<category-1-id>", "memo": "First split"},
    {"amount": -25.00, "categoryId": "<category-2-id>", "memo": "Second split"}
  ]
}
```

**Expected**:
- [ ] Returns `success: true` with transaction ID
- [ ] Message mentions "Split transaction created successfully with 2 subtransactions"
- [ ] Transaction visible in YNAB app as split
- [ ] Category shows "Split" on parent
- [ ] Each subtransaction has correct category and amount

### 1.2 Split with 3+ Categories
```json
{
  "budgetId": "c38a323c-ea58-4ca6-b3aa-dce8bdc80cc3",
  "accountId": "<account-id>",
  "date": "2024-01-15",
  "amount": -100.00,
  "payeeName": "Multi Split Test",
  "subtransactions": [
    {"amount": -40.00, "categoryId": "<category-1-id>"},
    {"amount": -35.00, "categoryId": "<category-2-id>"},
    {"amount": -25.00, "categoryId": "<category-3-id>"}
  ]
}
```

**Expected**:
- [ ] Returns `success: true`
- [ ] Message mentions "3 subtransactions"
- [ ] All 3 splits visible in YNAB

### 1.3 Split with Different Payees per Subtransaction
```json
{
  "budgetId": "c38a323c-ea58-4ca6-b3aa-dce8bdc80cc3",
  "accountId": "<account-id>",
  "date": "2024-01-15",
  "amount": -80.00,
  "payeeName": "Parent Payee",
  "subtransactions": [
    {"amount": -50.00, "categoryId": "<category-1-id>", "payeeName": "Sub Payee 1"},
    {"amount": -30.00, "categoryId": "<category-2-id>", "payeeName": "Sub Payee 2"}
  ]
}
```

**Expected**:
- [ ] Returns `success: true`
- [ ] Subtransactions show different payees in YNAB (if supported by YNAB UI)

---

## 2. Create Split Transaction - Error Cases

### 2.1 Reject when categoryId provided with subtransactions
```json
{
  "budgetId": "c38a323c-ea58-4ca6-b3aa-dce8bdc80cc3",
  "accountId": "<account-id>",
  "date": "2024-01-15",
  "amount": -75.00,
  "payeeName": "Should Fail",
  "categoryId": "<some-category-id>",
  "subtransactions": [
    {"amount": -50.00, "categoryId": "<category-1-id>"},
    {"amount": -25.00, "categoryId": "<category-2-id>"}
  ]
}
```

**Expected**:
- [ ] Returns `success: false`
- [ ] Error message: "categoryId must be omitted for split transactions"

### 2.2 Reject single subtransaction
```json
{
  "budgetId": "c38a323c-ea58-4ca6-b3aa-dce8bdc80cc3",
  "accountId": "<account-id>",
  "date": "2024-01-15",
  "amount": -50.00,
  "payeeName": "Should Fail",
  "subtransactions": [
    {"amount": -50.00, "categoryId": "<category-1-id>"}
  ]
}
```

**Expected**:
- [ ] Returns `success: false`
- [ ] Error message: "at least 2 subtransactions"

### 2.3 Subtransactions don't sum to total
```json
{
  "budgetId": "c38a323c-ea58-4ca6-b3aa-dce8bdc80cc3",
  "accountId": "<account-id>",
  "date": "2024-01-15",
  "amount": -100.00,
  "payeeName": "Mismatched Total",
  "subtransactions": [
    {"amount": -50.00, "categoryId": "<category-1-id>"},
    {"amount": -25.00, "categoryId": "<category-2-id>"}
  ]
}
```

**Expected**:
- [ ] YNAB API returns error (amounts don't match)
- [ ] Tool returns `success: false` with API error

---

## 3. Convert Transaction to Split

### 3.1 Convert Regular Transaction to Split

First, create a regular transaction:
```json
{
  "budgetId": "c38a323c-ea58-4ca6-b3aa-dce8bdc80cc3",
  "accountId": "<account-id>",
  "date": "2024-01-15",
  "amount": -60.00,
  "payeeName": "To Be Split",
  "categoryId": "<category-1-id>"
}
```

Note the returned `transactionId`, then convert:
```json
{
  "budgetId": "c38a323c-ea58-4ca6-b3aa-dce8bdc80cc3",
  "transactionId": "<transaction-id-from-above>",
  "subtransactions": [
    {"amount": -40.00, "categoryId": "<category-1-id>"},
    {"amount": -20.00, "categoryId": "<category-2-id>"}
  ]
}
```

**Expected**:
- [ ] Returns `success: true`
- [ ] Message: "Transaction converted to split with 2 subtransactions"
- [ ] Transaction in YNAB now shows as split

### 3.2 Convert with Other Updates
```json
{
  "budgetId": "c38a323c-ea58-4ca6-b3aa-dce8bdc80cc3",
  "transactionId": "<transaction-id>",
  "memo": "Updated and split",
  "approved": true,
  "subtransactions": [
    {"amount": -30.00, "categoryId": "<category-1-id>"},
    {"amount": -30.00, "categoryId": "<category-2-id>"}
  ]
}
```

**Expected**:
- [ ] Returns `success: true`
- [ ] Memo updated AND split applied
- [ ] Transaction approved

---

## 4. Convert to Split - Error Cases

### 4.1 Reject categoryId when converting to split
```json
{
  "budgetId": "c38a323c-ea58-4ca6-b3aa-dce8bdc80cc3",
  "transactionId": "<transaction-id>",
  "categoryId": "<some-category>",
  "subtransactions": [
    {"amount": -30.00, "categoryId": "<category-1-id>"},
    {"amount": -30.00, "categoryId": "<category-2-id>"}
  ]
}
```

**Expected**:
- [ ] Returns `success: false`
- [ ] Error: "categoryId cannot be set when converting to a split"

### 4.2 Attempt to modify existing split (YNAB limitation)

First create a split transaction, then try to update its subtransactions:
```json
{
  "budgetId": "c38a323c-ea58-4ca6-b3aa-dce8bdc80cc3",
  "transactionId": "<existing-split-transaction-id>",
  "subtransactions": [
    {"amount": -40.00, "categoryId": "<category-1-id>"},
    {"amount": -35.00, "categoryId": "<category-2-id>"}
  ]
}
```

**Expected**:
- [ ] YNAB API returns error
- [ ] Tool returns `success: false` with API error message

---

## 5. Search Split Transactions

### 5.1 Search by Category Finds Split Parent
```json
{
  "budgetId": "c38a323c-ea58-4ca6-b3aa-dce8bdc80cc3",
  "sinceDate": "2024-01-01",
  "categoryId": "<category-used-in-split-subtransaction>"
}
```

**Expected**:
- [ ] Returns the parent split transaction
- [ ] Parent transaction included when any subtransaction matches category

---

## 6. Cleanup

After testing:
- [ ] Delete test transactions from YNAB (via app or `delete_transaction` tool)
- [ ] Verify no orphan payees created

---

## Test Results

| Test | Pass/Fail | Notes |
|------|-----------|-------|
| 1.1 Basic Split | | |
| 1.2 3+ Categories | | |
| 1.3 Different Payees | | |
| 2.1 Reject categoryId + subtransactions | | |
| 2.2 Reject single subtransaction | | |
| 2.3 Mismatched totals | | |
| 3.1 Convert to Split | | |
| 3.2 Convert with Updates | | |
| 4.1 Reject categoryId on convert | | |
| 4.2 Modify existing split | | |
| 5.1 Search finds split | | |

**Tested By**: _______________
**Date**: _______________
**Version**: _______________
