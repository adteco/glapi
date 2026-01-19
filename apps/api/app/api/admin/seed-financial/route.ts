import { NextRequest, NextResponse } from 'next/server';
import { db } from '@glapi/database';
import { organizations, subsidiaries, accountingPeriods, accounts, glAccountBalances } from '@glapi/database/schema';
import { eq, and } from 'drizzle-orm';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Fixed UUIDs for consistent test data
const TEST_ORG_ID = 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2';
const TEST_SUBSIDIARY_ID = 'e7a1c3b5-2d4f-4a6e-8b9c-1d2e3f4a5b6c';
const TEST_PERIOD_2024_12_ID = 'f8b2d4c6-3e5a-4b7d-9c0e-2f3a4b5c6d7e';
const TEST_PERIOD_2024_11_ID = 'a9c3e5d7-4f6b-5c8e-0d1f-3a4b5c6d7e8f';
const TEST_PERIOD_2025_01_ID = 'b0d4f6e8-5a7c-6d9f-1e2a-4b5c6d7e8f9a';

// Account IDs
const ACCOUNT_IDS = {
  CASH: '10000000-0000-0000-0000-000000001000',
  ACCOUNTS_RECEIVABLE: '10000000-0000-0000-0000-000000001100',
  INVENTORY: '10000000-0000-0000-0000-000000001200',
  PREPAID_EXPENSES: '10000000-0000-0000-0000-000000001300',
  FIXED_ASSETS: '10000000-0000-0000-0000-000000001500',
  ACCUM_DEPRECIATION: '10000000-0000-0000-0000-000000001600',
  ACCOUNTS_PAYABLE: '20000000-0000-0000-0000-000000002000',
  ACCRUED_EXPENSES: '20000000-0000-0000-0000-000000002100',
  DEFERRED_REVENUE: '20000000-0000-0000-0000-000000002200',
  LONG_TERM_DEBT: '20000000-0000-0000-0000-000000002500',
  COMMON_STOCK: '30000000-0000-0000-0000-000000003000',
  RETAINED_EARNINGS: '30000000-0000-0000-0000-000000003100',
  PRODUCT_REVENUE: '40000000-0000-0000-0000-000000004000',
  SERVICE_REVENUE: '40000000-0000-0000-0000-000000004100',
  OTHER_INCOME: '40000000-0000-0000-0000-000000004200',
  COGS_PRODUCTS: '50000000-0000-0000-0000-000000005000',
  COGS_SERVICES: '50000000-0000-0000-0000-000000005100',
  SALARIES_EXPENSE: '60000000-0000-0000-0000-000000006000',
  RENT_EXPENSE: '60000000-0000-0000-0000-000000006100',
  UTILITIES_EXPENSE: '60000000-0000-0000-0000-000000006200',
  MARKETING_EXPENSE: '60000000-0000-0000-0000-000000006300',
  DEPRECIATION_EXPENSE: '60000000-0000-0000-0000-000000006400',
  OFFICE_SUPPLIES: '60000000-0000-0000-0000-000000006500',
  INSURANCE_EXPENSE: '60000000-0000-0000-0000-000000006600',
  PROFESSIONAL_FEES: '60000000-0000-0000-0000-000000006700',
};

// POST /api/admin/seed-financial
export async function POST(request: NextRequest) {
  const results: string[] = [];

  try {
    // 1. Create Organization
    results.push('1. Creating organization...');
    const existingOrg = await db.select().from(organizations).where(eq(organizations.id, TEST_ORG_ID));

    if (existingOrg.length === 0) {
      await db.insert(organizations).values({
        id: TEST_ORG_ID,
        name: 'Test Development Organization',
        stytchOrgId: 'org_development',
        slug: 'test-dev-org',
        settings: { currency: 'USD', fiscalYearStart: '01-01' }
      });
      results.push('   ✓ Organization created');
    } else {
      results.push('   ○ Organization already exists');
    }

    // 2. Create Subsidiary
    results.push('2. Creating subsidiary...');
    const existingSub = await db.select().from(subsidiaries).where(eq(subsidiaries.id, TEST_SUBSIDIARY_ID));

    if (existingSub.length === 0) {
      await db.insert(subsidiaries).values({
        id: TEST_SUBSIDIARY_ID,
        organizationId: TEST_ORG_ID,
        name: 'Main Subsidiary',
        code: 'MAIN',
        description: 'Primary operating subsidiary',
        countryCode: 'US',
        isActive: true
      });
      results.push('   ✓ Subsidiary created');
    } else {
      results.push('   ○ Subsidiary already exists');
    }

    // 3. Create Accounting Periods
    results.push('3. Creating accounting periods...');
    const periods = [
      { id: TEST_PERIOD_2024_11_ID, periodName: 'November 2024', fiscalYear: '2024', periodNumber: 11, startDate: '2024-11-01', endDate: '2024-11-30', status: 'CLOSED' },
      { id: TEST_PERIOD_2024_12_ID, periodName: 'December 2024', fiscalYear: '2024', periodNumber: 12, startDate: '2024-12-01', endDate: '2024-12-31', status: 'OPEN' },
      { id: TEST_PERIOD_2025_01_ID, periodName: 'January 2025', fiscalYear: '2025', periodNumber: 1, startDate: '2025-01-01', endDate: '2025-01-31', status: 'OPEN' }
    ];

    for (const period of periods) {
      const existing = await db.select().from(accountingPeriods).where(eq(accountingPeriods.id, period.id));
      if (existing.length === 0) {
        await db.insert(accountingPeriods).values({
          ...period,
          subsidiaryId: TEST_SUBSIDIARY_ID,
          periodType: 'MONTH',
          isAdjustmentPeriod: false
        });
        results.push(`   ✓ Period "${period.periodName}" created`);
      } else {
        results.push(`   ○ Period "${period.periodName}" already exists`);
      }
    }

    // 4. Create Chart of Accounts
    results.push('4. Creating chart of accounts...');
    const accountsData = [
      { id: ACCOUNT_IDS.CASH, accountNumber: '1000', accountName: 'Cash and Cash Equivalents', accountCategory: 'Asset' as const, accountSubcategory: 'CURRENT_ASSETS', normalBalance: 'DEBIT' },
      { id: ACCOUNT_IDS.ACCOUNTS_RECEIVABLE, accountNumber: '1100', accountName: 'Accounts Receivable', accountCategory: 'Asset' as const, accountSubcategory: 'CURRENT_ASSETS', normalBalance: 'DEBIT' },
      { id: ACCOUNT_IDS.INVENTORY, accountNumber: '1200', accountName: 'Inventory', accountCategory: 'Asset' as const, accountSubcategory: 'CURRENT_ASSETS', normalBalance: 'DEBIT' },
      { id: ACCOUNT_IDS.PREPAID_EXPENSES, accountNumber: '1300', accountName: 'Prepaid Expenses', accountCategory: 'Asset' as const, accountSubcategory: 'CURRENT_ASSETS', normalBalance: 'DEBIT' },
      { id: ACCOUNT_IDS.FIXED_ASSETS, accountNumber: '1500', accountName: 'Property, Plant & Equipment', accountCategory: 'Asset' as const, accountSubcategory: 'FIXED_ASSETS', normalBalance: 'DEBIT' },
      { id: ACCOUNT_IDS.ACCUM_DEPRECIATION, accountNumber: '1600', accountName: 'Accumulated Depreciation', accountCategory: 'Asset' as const, accountSubcategory: 'FIXED_ASSETS', normalBalance: 'CREDIT' },
      { id: ACCOUNT_IDS.ACCOUNTS_PAYABLE, accountNumber: '2000', accountName: 'Accounts Payable', accountCategory: 'Liability' as const, accountSubcategory: 'CURRENT_LIABILITIES', normalBalance: 'CREDIT' },
      { id: ACCOUNT_IDS.ACCRUED_EXPENSES, accountNumber: '2100', accountName: 'Accrued Expenses', accountCategory: 'Liability' as const, accountSubcategory: 'CURRENT_LIABILITIES', normalBalance: 'CREDIT' },
      { id: ACCOUNT_IDS.DEFERRED_REVENUE, accountNumber: '2200', accountName: 'Deferred Revenue', accountCategory: 'Liability' as const, accountSubcategory: 'CURRENT_LIABILITIES', normalBalance: 'CREDIT' },
      { id: ACCOUNT_IDS.LONG_TERM_DEBT, accountNumber: '2500', accountName: 'Long-Term Debt', accountCategory: 'Liability' as const, accountSubcategory: 'LONG_TERM_LIABILITIES', normalBalance: 'CREDIT' },
      { id: ACCOUNT_IDS.COMMON_STOCK, accountNumber: '3000', accountName: 'Common Stock', accountCategory: 'Equity' as const, accountSubcategory: 'CAPITAL', normalBalance: 'CREDIT' },
      { id: ACCOUNT_IDS.RETAINED_EARNINGS, accountNumber: '3100', accountName: 'Retained Earnings', accountCategory: 'Equity' as const, accountSubcategory: 'RETAINED_EARNINGS', normalBalance: 'CREDIT' },
      { id: ACCOUNT_IDS.PRODUCT_REVENUE, accountNumber: '4000', accountName: 'Product Revenue', accountCategory: 'Revenue' as const, accountSubcategory: 'OPERATING_REVENUE', normalBalance: 'CREDIT' },
      { id: ACCOUNT_IDS.SERVICE_REVENUE, accountNumber: '4100', accountName: 'Service Revenue', accountCategory: 'Revenue' as const, accountSubcategory: 'OPERATING_REVENUE', normalBalance: 'CREDIT' },
      { id: ACCOUNT_IDS.OTHER_INCOME, accountNumber: '4200', accountName: 'Other Income', accountCategory: 'Revenue' as const, accountSubcategory: 'OTHER_INCOME', normalBalance: 'CREDIT' },
      { id: ACCOUNT_IDS.COGS_PRODUCTS, accountNumber: '5000', accountName: 'Cost of Products Sold', accountCategory: 'COGS' as const, accountSubcategory: 'DIRECT_COSTS', normalBalance: 'DEBIT' },
      { id: ACCOUNT_IDS.COGS_SERVICES, accountNumber: '5100', accountName: 'Cost of Services', accountCategory: 'COGS' as const, accountSubcategory: 'DIRECT_COSTS', normalBalance: 'DEBIT' },
      { id: ACCOUNT_IDS.SALARIES_EXPENSE, accountNumber: '6000', accountName: 'Salaries & Wages', accountCategory: 'Expense' as const, accountSubcategory: 'OPERATING_EXPENSES', normalBalance: 'DEBIT' },
      { id: ACCOUNT_IDS.RENT_EXPENSE, accountNumber: '6100', accountName: 'Rent Expense', accountCategory: 'Expense' as const, accountSubcategory: 'OPERATING_EXPENSES', normalBalance: 'DEBIT' },
      { id: ACCOUNT_IDS.UTILITIES_EXPENSE, accountNumber: '6200', accountName: 'Utilities', accountCategory: 'Expense' as const, accountSubcategory: 'OPERATING_EXPENSES', normalBalance: 'DEBIT' },
      { id: ACCOUNT_IDS.MARKETING_EXPENSE, accountNumber: '6300', accountName: 'Marketing & Advertising', accountCategory: 'Expense' as const, accountSubcategory: 'OPERATING_EXPENSES', normalBalance: 'DEBIT' },
      { id: ACCOUNT_IDS.DEPRECIATION_EXPENSE, accountNumber: '6400', accountName: 'Depreciation Expense', accountCategory: 'Expense' as const, accountSubcategory: 'OPERATING_EXPENSES', normalBalance: 'DEBIT' },
      { id: ACCOUNT_IDS.OFFICE_SUPPLIES, accountNumber: '6500', accountName: 'Office Supplies', accountCategory: 'Expense' as const, accountSubcategory: 'OPERATING_EXPENSES', normalBalance: 'DEBIT' },
      { id: ACCOUNT_IDS.INSURANCE_EXPENSE, accountNumber: '6600', accountName: 'Insurance Expense', accountCategory: 'Expense' as const, accountSubcategory: 'OPERATING_EXPENSES', normalBalance: 'DEBIT' },
      { id: ACCOUNT_IDS.PROFESSIONAL_FEES, accountNumber: '6700', accountName: 'Professional Fees', accountCategory: 'Expense' as const, accountSubcategory: 'OPERATING_EXPENSES', normalBalance: 'DEBIT' },
    ];

    let accountsCreated = 0;
    for (const account of accountsData) {
      const existing = await db.select().from(accounts).where(eq(accounts.id, account.id));
      if (existing.length === 0) {
        await db.insert(accounts).values({
          ...account,
          organizationId: TEST_ORG_ID,
          isActive: true
        });
        accountsCreated++;
      }
    }
    results.push(`   ✓ Created ${accountsCreated} accounts (${accountsData.length - accountsCreated} already existed)`);

    // 5. Create GL Account Balances
    results.push('5. Creating account balances...');

    const createBalance = async (
      accountId: string,
      periodId: string,
      periodDebit: number,
      periodCredit: number,
      ytdDebit: number,
      ytdCredit: number
    ): Promise<boolean> => {
      const existing = await db.select().from(glAccountBalances).where(
        and(
          eq(glAccountBalances.accountId, accountId),
          eq(glAccountBalances.periodId, periodId),
          eq(glAccountBalances.subsidiaryId, TEST_SUBSIDIARY_ID)
        )
      );

      if (existing.length === 0) {
        await db.insert(glAccountBalances).values({
          accountId,
          subsidiaryId: TEST_SUBSIDIARY_ID,
          periodId,
          currencyCode: 'USD',
          beginningBalanceDebit: '0',
          beginningBalanceCredit: '0',
          periodDebitAmount: periodDebit.toFixed(4),
          periodCreditAmount: periodCredit.toFixed(4),
          endingBalanceDebit: periodDebit.toFixed(4),
          endingBalanceCredit: periodCredit.toFixed(4),
          ytdDebitAmount: ytdDebit.toFixed(4),
          ytdCreditAmount: ytdCredit.toFixed(4),
          baseBeginningBalanceDebit: '0',
          baseBeginningBalanceCredit: '0',
          basePeriodDebitAmount: periodDebit.toFixed(4),
          basePeriodCreditAmount: periodCredit.toFixed(4),
          baseEndingBalanceDebit: periodDebit.toFixed(4),
          baseEndingBalanceCredit: periodCredit.toFixed(4),
          baseYtdDebitAmount: ytdDebit.toFixed(4),
          baseYtdCreditAmount: ytdCredit.toFixed(4),
        });
        return true;
      }
      return false;
    };

    const dec2024Balances = [
      { accountId: ACCOUNT_IDS.CASH, periodDebit: 125000, periodCredit: 0, ytdDebit: 1500000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.ACCOUNTS_RECEIVABLE, periodDebit: 85000, periodCredit: 0, ytdDebit: 850000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.INVENTORY, periodDebit: 45000, periodCredit: 0, ytdDebit: 540000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.PREPAID_EXPENSES, periodDebit: 8000, periodCredit: 0, ytdDebit: 96000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.FIXED_ASSETS, periodDebit: 250000, periodCredit: 0, ytdDebit: 250000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.ACCUM_DEPRECIATION, periodDebit: 0, periodCredit: 50000, ytdDebit: 0, ytdCredit: 50000 },
      { accountId: ACCOUNT_IDS.ACCOUNTS_PAYABLE, periodDebit: 0, periodCredit: 42000, ytdDebit: 0, ytdCredit: 504000 },
      { accountId: ACCOUNT_IDS.ACCRUED_EXPENSES, periodDebit: 0, periodCredit: 18000, ytdDebit: 0, ytdCredit: 216000 },
      { accountId: ACCOUNT_IDS.DEFERRED_REVENUE, periodDebit: 0, periodCredit: 35000, ytdDebit: 0, ytdCredit: 420000 },
      { accountId: ACCOUNT_IDS.LONG_TERM_DEBT, periodDebit: 0, periodCredit: 150000, ytdDebit: 0, ytdCredit: 150000 },
      { accountId: ACCOUNT_IDS.COMMON_STOCK, periodDebit: 0, periodCredit: 100000, ytdDebit: 0, ytdCredit: 100000 },
      { accountId: ACCOUNT_IDS.RETAINED_EARNINGS, periodDebit: 0, periodCredit: 250000, ytdDebit: 0, ytdCredit: 250000 },
      { accountId: ACCOUNT_IDS.PRODUCT_REVENUE, periodDebit: 0, periodCredit: 180000, ytdDebit: 0, ytdCredit: 2160000 },
      { accountId: ACCOUNT_IDS.SERVICE_REVENUE, periodDebit: 0, periodCredit: 75000, ytdDebit: 0, ytdCredit: 900000 },
      { accountId: ACCOUNT_IDS.OTHER_INCOME, periodDebit: 0, periodCredit: 5000, ytdDebit: 0, ytdCredit: 60000 },
      { accountId: ACCOUNT_IDS.COGS_PRODUCTS, periodDebit: 90000, periodCredit: 0, ytdDebit: 1080000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.COGS_SERVICES, periodDebit: 30000, periodCredit: 0, ytdDebit: 360000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.SALARIES_EXPENSE, periodDebit: 65000, periodCredit: 0, ytdDebit: 780000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.RENT_EXPENSE, periodDebit: 12000, periodCredit: 0, ytdDebit: 144000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.UTILITIES_EXPENSE, periodDebit: 3500, periodCredit: 0, ytdDebit: 42000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.MARKETING_EXPENSE, periodDebit: 8000, periodCredit: 0, ytdDebit: 96000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.DEPRECIATION_EXPENSE, periodDebit: 4167, periodCredit: 0, ytdDebit: 50004, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.OFFICE_SUPPLIES, periodDebit: 1500, periodCredit: 0, ytdDebit: 18000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.INSURANCE_EXPENSE, periodDebit: 2500, periodCredit: 0, ytdDebit: 30000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.PROFESSIONAL_FEES, periodDebit: 5000, periodCredit: 0, ytdDebit: 60000, ytdCredit: 0 },
    ];

    let balancesCreated = 0;
    for (const balance of dec2024Balances) {
      if (await createBalance(balance.accountId, TEST_PERIOD_2024_12_ID, balance.periodDebit, balance.periodCredit, balance.ytdDebit, balance.ytdCredit)) {
        balancesCreated++;
      }
    }
    results.push(`   ✓ Created ${balancesCreated} balances for December 2024`);

    // November balances
    balancesCreated = 0;
    for (const balance of dec2024Balances) {
      const novBalance = {
        ...balance,
        periodDebit: Math.round(balance.periodDebit * 0.95),
        periodCredit: Math.round(balance.periodCredit * 0.95),
        ytdDebit: balance.ytdDebit - balance.periodDebit,
        ytdCredit: balance.ytdCredit - balance.periodCredit
      };
      if (await createBalance(novBalance.accountId, TEST_PERIOD_2024_11_ID, novBalance.periodDebit, novBalance.periodCredit, novBalance.ytdDebit, novBalance.ytdCredit)) {
        balancesCreated++;
      }
    }
    results.push(`   ✓ Created ${balancesCreated} balances for November 2024`);

    results.push('');
    results.push('========================================');
    results.push('Financial test data seeding complete!');
    results.push('========================================');
    results.push('');
    results.push('Test with:');
    results.push(`  GET /api/gl/reports/income-statement?periodId=${TEST_PERIOD_2024_12_ID}`);
    results.push(`  GET /api/gl/reports/balance-sheet?periodId=${TEST_PERIOD_2024_12_ID}`);

    return NextResponse.json({
      success: true,
      message: 'Financial test data seeded successfully',
      log: results,
      testPeriodId: TEST_PERIOD_2024_12_ID
    });

  } catch (error) {
    console.error('Error seeding financial test data:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      log: results
    }, { status: 500 });
  }
}
