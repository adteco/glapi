import { describe, it, expect } from 'vitest';
import {
  AccountCategory,
  AccountSubcategory,
  NormalBalance,
  CashFlowCategory,
  AccountDimension,
  getNormalBalanceForCategory,
  isDebitIncrease,
  getDefaultCashFlowCategory,
  validateAccountNumber,
  getCategoryFromAccountNumber,
  AccountNumberingScheme,
} from '../types';
import {
  getSaaSChartOfAccounts,
  createCustomChartOfAccounts,
  validateChartOfAccounts,
  getAccountByNumber,
  getAccountsByCategory,
  getAccountsBySubcategory,
} from '../templates';

// ============================================================================
// Type Tests
// ============================================================================

describe('Chart of Accounts Types', () => {
  describe('getNormalBalanceForCategory', () => {
    it('should return DEBIT for ASSETS', () => {
      expect(getNormalBalanceForCategory(AccountCategory.ASSETS)).toBe(NormalBalance.DEBIT);
    });

    it('should return DEBIT for EXPENSES', () => {
      expect(getNormalBalanceForCategory(AccountCategory.EXPENSES)).toBe(NormalBalance.DEBIT);
    });

    it('should return CREDIT for LIABILITIES', () => {
      expect(getNormalBalanceForCategory(AccountCategory.LIABILITIES)).toBe(NormalBalance.CREDIT);
    });

    it('should return CREDIT for EQUITY', () => {
      expect(getNormalBalanceForCategory(AccountCategory.EQUITY)).toBe(NormalBalance.CREDIT);
    });

    it('should return CREDIT for REVENUE', () => {
      expect(getNormalBalanceForCategory(AccountCategory.REVENUE)).toBe(NormalBalance.CREDIT);
    });
  });

  describe('isDebitIncrease', () => {
    it('should return true for ASSETS', () => {
      expect(isDebitIncrease(AccountCategory.ASSETS)).toBe(true);
    });

    it('should return true for EXPENSES', () => {
      expect(isDebitIncrease(AccountCategory.EXPENSES)).toBe(true);
    });

    it('should return false for LIABILITIES', () => {
      expect(isDebitIncrease(AccountCategory.LIABILITIES)).toBe(false);
    });

    it('should return false for EQUITY', () => {
      expect(isDebitIncrease(AccountCategory.EQUITY)).toBe(false);
    });

    it('should return false for REVENUE', () => {
      expect(isDebitIncrease(AccountCategory.REVENUE)).toBe(false);
    });
  });

  describe('getDefaultCashFlowCategory', () => {
    it('should return OPERATING for accounts receivable', () => {
      expect(getDefaultCashFlowCategory(AccountSubcategory.ACCOUNTS_RECEIVABLE)).toBe(
        CashFlowCategory.OPERATING
      );
    });

    it('should return OPERATING for operating expenses', () => {
      expect(getDefaultCashFlowCategory(AccountSubcategory.OPERATING_EXPENSES)).toBe(
        CashFlowCategory.OPERATING
      );
    });

    it('should return INVESTING for fixed assets', () => {
      expect(getDefaultCashFlowCategory(AccountSubcategory.FIXED_ASSETS)).toBe(
        CashFlowCategory.INVESTING
      );
    });

    it('should return INVESTING for intangible assets', () => {
      expect(getDefaultCashFlowCategory(AccountSubcategory.INTANGIBLE_ASSETS)).toBe(
        CashFlowCategory.INVESTING
      );
    });

    it('should return FINANCING for long-term debt', () => {
      expect(getDefaultCashFlowCategory(AccountSubcategory.LONG_TERM_DEBT)).toBe(
        CashFlowCategory.FINANCING
      );
    });

    it('should return FINANCING for common stock', () => {
      expect(getDefaultCashFlowCategory(AccountSubcategory.COMMON_STOCK)).toBe(
        CashFlowCategory.FINANCING
      );
    });

    it('should return NONE for cash and equivalents', () => {
      expect(getDefaultCashFlowCategory(AccountSubcategory.CASH_AND_EQUIVALENTS)).toBe(
        CashFlowCategory.NONE
      );
    });

    it('should return NONE for retained earnings', () => {
      expect(getDefaultCashFlowCategory(AccountSubcategory.RETAINED_EARNINGS)).toBe(
        CashFlowCategory.NONE
      );
    });
  });

  describe('validateAccountNumber', () => {
    const scheme: AccountNumberingScheme = {
      digits: 4,
      categoryRanges: {
        ASSETS: { start: '1000', end: '1999' },
        LIABILITIES: { start: '2000', end: '2999' },
        EQUITY: { start: '3000', end: '3999' },
        REVENUE: { start: '4000', end: '4999' },
        EXPENSES: { start: '5000', end: '9999' },
      },
    };

    it('should validate correct account number length', () => {
      const result = validateAccountNumber('1000', scheme);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject account number with wrong length', () => {
      const result = validateAccountNumber('100', scheme);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Account number must have 4 digits, got 3');
    });

    it('should reject account number that is too long', () => {
      const result = validateAccountNumber('10000', scheme);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Account number must have 4 digits, got 5');
    });
  });

  describe('getCategoryFromAccountNumber', () => {
    const scheme: AccountNumberingScheme = {
      digits: 4,
      categoryRanges: {
        ASSETS: { start: '1000', end: '1999' },
        LIABILITIES: { start: '2000', end: '2999' },
        EQUITY: { start: '3000', end: '3999' },
        REVENUE: { start: '4000', end: '4999' },
        EXPENSES: { start: '5000', end: '9999' },
      },
    };

    it('should identify ASSETS category', () => {
      expect(getCategoryFromAccountNumber('1000', scheme)).toBe(AccountCategory.ASSETS);
      expect(getCategoryFromAccountNumber('1500', scheme)).toBe(AccountCategory.ASSETS);
      expect(getCategoryFromAccountNumber('1999', scheme)).toBe(AccountCategory.ASSETS);
    });

    it('should identify LIABILITIES category', () => {
      expect(getCategoryFromAccountNumber('2000', scheme)).toBe(AccountCategory.LIABILITIES);
      expect(getCategoryFromAccountNumber('2500', scheme)).toBe(AccountCategory.LIABILITIES);
    });

    it('should identify EQUITY category', () => {
      expect(getCategoryFromAccountNumber('3000', scheme)).toBe(AccountCategory.EQUITY);
      expect(getCategoryFromAccountNumber('3500', scheme)).toBe(AccountCategory.EQUITY);
    });

    it('should identify REVENUE category', () => {
      expect(getCategoryFromAccountNumber('4000', scheme)).toBe(AccountCategory.REVENUE);
      expect(getCategoryFromAccountNumber('4999', scheme)).toBe(AccountCategory.REVENUE);
    });

    it('should identify EXPENSES category', () => {
      expect(getCategoryFromAccountNumber('5000', scheme)).toBe(AccountCategory.EXPENSES);
      expect(getCategoryFromAccountNumber('9999', scheme)).toBe(AccountCategory.EXPENSES);
    });

    it('should return null for out-of-range account', () => {
      expect(getCategoryFromAccountNumber('0000', scheme)).toBe(null);
    });
  });
});

// ============================================================================
// Template Tests
// ============================================================================

describe('Chart of Accounts Templates', () => {
  describe('getSaaSChartOfAccounts', () => {
    it('should return a valid chart of accounts', () => {
      const coa = getSaaSChartOfAccounts();

      expect(coa).toBeDefined();
      expect(coa.name).toBe('SaaS Standard Chart of Accounts');
      expect(coa.baseCurrency).toBe('USD');
      expect(coa.accounts.length).toBeGreaterThan(0);
    });

    it('should have all required default accounts', () => {
      const coa = getSaaSChartOfAccounts();

      expect(coa.defaultAccounts.accountsReceivable).toBe('1200');
      expect(coa.defaultAccounts.accountsPayable).toBe('2000');
      expect(coa.defaultAccounts.deferredRevenue).toBe('2100');
      expect(coa.defaultAccounts.revenue).toBe('4000');
      expect(coa.defaultAccounts.costOfGoodsSold).toBe('5000');
      expect(coa.defaultAccounts.inventory).toBe('1300');
      expect(coa.defaultAccounts.cash).toBe('1000');
      expect(coa.defaultAccounts.retainedEarnings).toBe('3200');
    });

    it('should have correct account numbering scheme', () => {
      const coa = getSaaSChartOfAccounts();

      expect(coa.numberingScheme.digits).toBe(4);
      expect(coa.numberingScheme.categoryRanges.ASSETS?.start).toBe('1000');
      expect(coa.numberingScheme.categoryRanges.ASSETS?.end).toBe('1999');
    });

    it('should include account hierarchies', () => {
      const coa = getSaaSChartOfAccounts();

      expect(coa.hierarchies).toBeDefined();
      expect(coa.hierarchies?.length).toBeGreaterThan(0);

      const balanceSheet = coa.hierarchies?.find(h => h.name === 'Balance Sheet');
      expect(balanceSheet).toBeDefined();
      expect(balanceSheet?.nodes.length).toBeGreaterThan(0);

      const incomeStatement = coa.hierarchies?.find(h => h.name === 'Income Statement');
      expect(incomeStatement).toBeDefined();
    });
  });

  describe('createCustomChartOfAccounts', () => {
    it('should create custom chart with provided name and currency', () => {
      const coa = createCustomChartOfAccounts({ name: 'My Company', baseCurrency: 'EUR' });

      expect(coa.name).toBe('My Company');
      expect(coa.baseCurrency).toBe('EUR');
    });

    it('should use SaaS template as base', () => {
      const coa = createCustomChartOfAccounts({ name: 'Test' });
      const saas = getSaaSChartOfAccounts();

      // Should have same accounts
      expect(coa.accounts.length).toBe(saas.accounts.length);
    });
  });

  describe('validateChartOfAccounts', () => {
    it('should validate correct chart of accounts', () => {
      const coa = getSaaSChartOfAccounts();
      const result = validateChartOfAccounts(coa);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect duplicate account numbers', () => {
      const coa = getSaaSChartOfAccounts();
      // Add duplicate account
      coa.accounts.push({
        ...coa.accounts[0],
        accountName: 'Duplicate',
      });

      const result = validateChartOfAccounts(coa);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate'))).toBe(true);
    });

    it('should detect invalid default account reference', () => {
      const coa = getSaaSChartOfAccounts();
      coa.defaultAccounts.cash = '9999'; // Non-existent account

      const result = validateChartOfAccounts(coa);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('9999'))).toBe(true);
    });
  });

  describe('getAccountByNumber', () => {
    it('should find account by number', () => {
      const coa = getSaaSChartOfAccounts();
      const account = getAccountByNumber(coa, '1000');

      expect(account).toBeDefined();
      expect(account?.accountNumber).toBe('1000');
      expect(account?.accountName).toBe('Cash - Operating Account');
    });

    it('should return undefined for non-existent account', () => {
      const coa = getSaaSChartOfAccounts();
      const account = getAccountByNumber(coa, '9999');

      expect(account).toBeUndefined();
    });
  });

  describe('getAccountsByCategory', () => {
    it('should return all asset accounts', () => {
      const coa = getSaaSChartOfAccounts();
      const assets = getAccountsByCategory(coa, 'ASSETS');

      expect(assets.length).toBeGreaterThan(0);
      expect(assets.every(a => a.category === AccountCategory.ASSETS)).toBe(true);
    });

    it('should return all liability accounts', () => {
      const coa = getSaaSChartOfAccounts();
      const liabilities = getAccountsByCategory(coa, 'LIABILITIES');

      expect(liabilities.length).toBeGreaterThan(0);
      expect(liabilities.every(a => a.category === AccountCategory.LIABILITIES)).toBe(true);
    });

    it('should return all equity accounts', () => {
      const coa = getSaaSChartOfAccounts();
      const equity = getAccountsByCategory(coa, 'EQUITY');

      expect(equity.length).toBeGreaterThan(0);
      expect(equity.every(a => a.category === AccountCategory.EQUITY)).toBe(true);
    });

    it('should return all revenue accounts', () => {
      const coa = getSaaSChartOfAccounts();
      const revenue = getAccountsByCategory(coa, 'REVENUE');

      expect(revenue.length).toBeGreaterThan(0);
      expect(revenue.every(a => a.category === AccountCategory.REVENUE)).toBe(true);
    });

    it('should return all expense accounts', () => {
      const coa = getSaaSChartOfAccounts();
      const expenses = getAccountsByCategory(coa, 'EXPENSES');

      expect(expenses.length).toBeGreaterThan(0);
      expect(expenses.every(a => a.category === AccountCategory.EXPENSES)).toBe(true);
    });
  });

  describe('getAccountsBySubcategory', () => {
    it('should return cash accounts', () => {
      const coa = getSaaSChartOfAccounts();
      const cash = getAccountsBySubcategory(coa, 'CASH_AND_EQUIVALENTS');

      expect(cash.length).toBeGreaterThan(0);
      expect(cash.every(a => a.subcategory === AccountSubcategory.CASH_AND_EQUIVALENTS)).toBe(true);
    });

    it('should return accounts receivable accounts', () => {
      const coa = getSaaSChartOfAccounts();
      const ar = getAccountsBySubcategory(coa, 'ACCOUNTS_RECEIVABLE');

      expect(ar.length).toBeGreaterThan(0);
      expect(ar.every(a => a.subcategory === AccountSubcategory.ACCOUNTS_RECEIVABLE)).toBe(true);
    });

    it('should return deferred revenue accounts', () => {
      const coa = getSaaSChartOfAccounts();
      const deferred = getAccountsBySubcategory(coa, 'DEFERRED_REVENUE');

      expect(deferred.length).toBeGreaterThan(0);
      expect(deferred.every(a => a.subcategory === AccountSubcategory.DEFERRED_REVENUE)).toBe(true);
    });
  });

  describe('Account Properties', () => {
    it('should set normal balance based on category', () => {
      const coa = getSaaSChartOfAccounts();

      // Verify at least some accounts use the helper function
      const assetAccount = coa.accounts.find(a => a.category === AccountCategory.ASSETS);
      expect(assetAccount?.normalBalance).toBe(NormalBalance.DEBIT);

      const liabilityAccount = coa.accounts.find(a => a.category === AccountCategory.LIABILITIES);
      expect(liabilityAccount?.normalBalance).toBe(NormalBalance.CREDIT);

      const revenueAccount = coa.accounts.find(a => a.category === AccountCategory.REVENUE);
      expect(revenueAccount?.normalBalance).toBe(NormalBalance.CREDIT);

      const expenseAccount = coa.accounts.find(a => a.category === AccountCategory.EXPENSES);
      expect(expenseAccount?.normalBalance).toBe(NormalBalance.DEBIT);
    });

    it('should have all accounts as active by default', () => {
      const coa = getSaaSChartOfAccounts();

      for (const account of coa.accounts) {
        expect(account.isActive).toBe(true);
      }
    });

    it('should have correct cash flow categories for key accounts', () => {
      const coa = getSaaSChartOfAccounts();

      // Check some specific accounts
      const cash = getAccountByNumber(coa, '1000');
      expect(cash?.cashFlowCategory).toBe(CashFlowCategory.NONE);

      const ar = getAccountByNumber(coa, '1200');
      expect(ar?.cashFlowCategory).toBe(CashFlowCategory.OPERATING);

      // Verify operating expenses have OPERATING category
      const operatingExpense = coa.accounts.find(
        a => a.subcategory === AccountSubcategory.OPERATING_EXPENSES
      );
      expect(operatingExpense?.cashFlowCategory).toBe(CashFlowCategory.OPERATING);
    });

    it('should mark control accounts correctly', () => {
      const coa = getSaaSChartOfAccounts();

      // Check AR is a control account
      const ar = getAccountByNumber(coa, '1200');
      expect(ar?.isControlAccount).toBe(true);
      expect(ar?.allowPosting).toBe(false);

      // Check AP is a control account
      const ap = getAccountByNumber(coa, '2000');
      expect(ap?.isControlAccount).toBe(true);
      expect(ap?.allowPosting).toBe(false);
    });
  });
});

// ============================================================================
// Account Dimension Tests
// ============================================================================

describe('Account Dimensions', () => {
  it('should have all expected dimensions defined', () => {
    expect(AccountDimension.SUBSIDIARY).toBe('SUBSIDIARY');
    expect(AccountDimension.DEPARTMENT).toBe('DEPARTMENT');
    expect(AccountDimension.LOCATION).toBe('LOCATION');
    expect(AccountDimension.CLASS).toBe('CLASS');
    expect(AccountDimension.PROJECT).toBe('PROJECT');
    expect(AccountDimension.CUSTOMER).toBe('CUSTOMER');
    expect(AccountDimension.VENDOR).toBe('VENDOR');
    expect(AccountDimension.EMPLOYEE).toBe('EMPLOYEE');
    expect(AccountDimension.ITEM).toBe('ITEM');
  });
});
