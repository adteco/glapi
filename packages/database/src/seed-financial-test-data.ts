/**
 * Seed Script for Test Financial Data
 *
 * Creates test data for financial statements including:
 * - Organization
 * - Subsidiary
 * - Accounting periods
 * - Chart of accounts
 * - GL account balances
 *
 * Run with: pnpm --filter @glapi/database seed:financial
 */

import * as dotenv from 'dotenv';

// Load environment variables from the database package's .env.local first
dotenv.config({ path: '.env.local' });

// Fallback: try the api .env.local if the first one doesn't have DATABASE_URL
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: '../apps/api/.env.local' });
}

import { db } from './db';
import { organizations } from './db/schema/organizations';
import { subsidiaries } from './db/schema/subsidiaries';
import { accountingPeriods } from './db/schema/accounting-periods';
import { accounts } from './db/schema/accounts';
import { glAccountBalances } from './db/schema/gl-transactions';
import { eq, and } from 'drizzle-orm';

// Fixed UUIDs for consistent test data
const TEST_ORG_ID = 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2';
const TEST_SUBSIDIARY_ID = 'e7a1c3b5-2d4f-4a6e-8b9c-1d2e3f4a5b6c';
const TEST_PERIOD_2024_12_ID = 'f8b2d4c6-3e5a-4b7d-9c0e-2f3a4b5c6d7e';
const TEST_PERIOD_2024_11_ID = 'a9c3e5d7-4f6b-5c8e-0d1f-3a4b5c6d7e8f';
const TEST_PERIOD_2025_01_ID = 'b0d4f6e8-5a7c-6d9f-1e2a-4b5c6d7e8f9a';

// Account IDs for reference
const ACCOUNT_IDS = {
  // Assets
  CASH: '10000000-0000-0000-0000-000000001000',
  ACCOUNTS_RECEIVABLE: '10000000-0000-0000-0000-000000001100',
  INVENTORY: '10000000-0000-0000-0000-000000001200',
  PREPAID_EXPENSES: '10000000-0000-0000-0000-000000001300',
  FIXED_ASSETS: '10000000-0000-0000-0000-000000001500',
  ACCUM_DEPRECIATION: '10000000-0000-0000-0000-000000001600',

  // Liabilities
  ACCOUNTS_PAYABLE: '20000000-0000-0000-0000-000000002000',
  ACCRUED_EXPENSES: '20000000-0000-0000-0000-000000002100',
  DEFERRED_REVENUE: '20000000-0000-0000-0000-000000002200',
  LONG_TERM_DEBT: '20000000-0000-0000-0000-000000002500',

  // Equity
  COMMON_STOCK: '30000000-0000-0000-0000-000000003000',
  RETAINED_EARNINGS: '30000000-0000-0000-0000-000000003100',

  // Revenue
  PRODUCT_REVENUE: '40000000-0000-0000-0000-000000004000',
  SERVICE_REVENUE: '40000000-0000-0000-0000-000000004100',
  OTHER_INCOME: '40000000-0000-0000-0000-000000004200',

  // COGS
  COGS_PRODUCTS: '50000000-0000-0000-0000-000000005000',
  COGS_SERVICES: '50000000-0000-0000-0000-000000005100',

  // Expenses
  SALARIES_EXPENSE: '60000000-0000-0000-0000-000000006000',
  RENT_EXPENSE: '60000000-0000-0000-0000-000000006100',
  UTILITIES_EXPENSE: '60000000-0000-0000-0000-000000006200',
  MARKETING_EXPENSE: '60000000-0000-0000-0000-000000006300',
  DEPRECIATION_EXPENSE: '60000000-0000-0000-0000-000000006400',
  OFFICE_SUPPLIES: '60000000-0000-0000-0000-000000006500',
  INSURANCE_EXPENSE: '60000000-0000-0000-0000-000000006600',
  PROFESSIONAL_FEES: '60000000-0000-0000-0000-000000006700',
};

async function seedFinancialTestData() {
  console.log('Starting financial test data seed...\n');

  try {
    // 1. Create or update Organization
    console.log('1. Creating organization...');
    const existingOrg = await db.select().from(organizations).where(eq(organizations.id, TEST_ORG_ID));

    if (existingOrg.length === 0) {
      await db.insert(organizations).values({
        id: TEST_ORG_ID,
        name: 'Test Development Organization',
        stytchOrgId: 'org_development',
        slug: 'test-dev-org',
        settings: { currency: 'USD', fiscalYearStart: '01-01' }
      });
      console.log('   ✓ Organization created');
    } else {
      console.log('   ○ Organization already exists');
    }

    // 2. Create Subsidiary
    console.log('2. Creating subsidiary...');
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
      console.log('   ✓ Subsidiary created');
    } else {
      console.log('   ○ Subsidiary already exists');
    }

    // 3. Create Accounting Periods
    console.log('3. Creating accounting periods...');
    const periods = [
      {
        id: TEST_PERIOD_2024_11_ID,
        subsidiaryId: TEST_SUBSIDIARY_ID,
        periodName: 'November 2024',
        fiscalYear: '2024',
        periodNumber: 11,
        startDate: '2024-11-01',
        endDate: '2024-11-30',
        periodType: 'MONTH',
        status: 'CLOSED',
        isAdjustmentPeriod: false
      },
      {
        id: TEST_PERIOD_2024_12_ID,
        subsidiaryId: TEST_SUBSIDIARY_ID,
        periodName: 'December 2024',
        fiscalYear: '2024',
        periodNumber: 12,
        startDate: '2024-12-01',
        endDate: '2024-12-31',
        periodType: 'MONTH',
        status: 'OPEN',
        isAdjustmentPeriod: false
      },
      {
        id: TEST_PERIOD_2025_01_ID,
        subsidiaryId: TEST_SUBSIDIARY_ID,
        periodName: 'January 2025',
        fiscalYear: '2025',
        periodNumber: 1,
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        periodType: 'MONTH',
        status: 'OPEN',
        isAdjustmentPeriod: false
      }
    ];

    for (const period of periods) {
      const existing = await db.select().from(accountingPeriods).where(eq(accountingPeriods.id, period.id));
      if (existing.length === 0) {
        await db.insert(accountingPeriods).values(period);
        console.log(`   ✓ Period "${period.periodName}" created`);
      } else {
        console.log(`   ○ Period "${period.periodName}" already exists`);
      }
    }

    // 4. Create Chart of Accounts
    console.log('4. Creating chart of accounts...');
    const accountsData = [
      // Assets (1xxx)
      { id: ACCOUNT_IDS.CASH, accountNumber: '1000', accountName: 'Cash and Cash Equivalents', accountCategory: 'Asset' as const, accountSubcategory: 'CURRENT_ASSETS', normalBalance: 'DEBIT', cashFlowCategory: 'OPERATING' },
      { id: ACCOUNT_IDS.ACCOUNTS_RECEIVABLE, accountNumber: '1100', accountName: 'Accounts Receivable', accountCategory: 'Asset' as const, accountSubcategory: 'CURRENT_ASSETS', normalBalance: 'DEBIT', cashFlowCategory: 'OPERATING' },
      { id: ACCOUNT_IDS.INVENTORY, accountNumber: '1200', accountName: 'Inventory', accountCategory: 'Asset' as const, accountSubcategory: 'CURRENT_ASSETS', normalBalance: 'DEBIT', cashFlowCategory: 'OPERATING' },
      { id: ACCOUNT_IDS.PREPAID_EXPENSES, accountNumber: '1300', accountName: 'Prepaid Expenses', accountCategory: 'Asset' as const, accountSubcategory: 'CURRENT_ASSETS', normalBalance: 'DEBIT', cashFlowCategory: 'OPERATING' },
      { id: ACCOUNT_IDS.FIXED_ASSETS, accountNumber: '1500', accountName: 'Property, Plant & Equipment', accountCategory: 'Asset' as const, accountSubcategory: 'FIXED_ASSETS', normalBalance: 'DEBIT', cashFlowCategory: 'INVESTING' },
      { id: ACCOUNT_IDS.ACCUM_DEPRECIATION, accountNumber: '1600', accountName: 'Accumulated Depreciation', accountCategory: 'Asset' as const, accountSubcategory: 'FIXED_ASSETS', normalBalance: 'CREDIT', cashFlowCategory: 'INVESTING' },

      // Liabilities (2xxx)
      { id: ACCOUNT_IDS.ACCOUNTS_PAYABLE, accountNumber: '2000', accountName: 'Accounts Payable', accountCategory: 'Liability' as const, accountSubcategory: 'CURRENT_LIABILITIES', normalBalance: 'CREDIT', cashFlowCategory: 'OPERATING' },
      { id: ACCOUNT_IDS.ACCRUED_EXPENSES, accountNumber: '2100', accountName: 'Accrued Expenses', accountCategory: 'Liability' as const, accountSubcategory: 'CURRENT_LIABILITIES', normalBalance: 'CREDIT', cashFlowCategory: 'OPERATING' },
      { id: ACCOUNT_IDS.DEFERRED_REVENUE, accountNumber: '2200', accountName: 'Deferred Revenue', accountCategory: 'Liability' as const, accountSubcategory: 'CURRENT_LIABILITIES', normalBalance: 'CREDIT', cashFlowCategory: 'OPERATING' },
      { id: ACCOUNT_IDS.LONG_TERM_DEBT, accountNumber: '2500', accountName: 'Long-Term Debt', accountCategory: 'Liability' as const, accountSubcategory: 'LONG_TERM_LIABILITIES', normalBalance: 'CREDIT', cashFlowCategory: 'FINANCING' },

      // Equity (3xxx)
      { id: ACCOUNT_IDS.COMMON_STOCK, accountNumber: '3000', accountName: 'Common Stock', accountCategory: 'Equity' as const, accountSubcategory: 'CAPITAL', normalBalance: 'CREDIT', cashFlowCategory: 'FINANCING' },
      { id: ACCOUNT_IDS.RETAINED_EARNINGS, accountNumber: '3100', accountName: 'Retained Earnings', accountCategory: 'Equity' as const, accountSubcategory: 'RETAINED_EARNINGS', normalBalance: 'CREDIT', cashFlowCategory: null },

      // Revenue (4xxx)
      { id: ACCOUNT_IDS.PRODUCT_REVENUE, accountNumber: '4000', accountName: 'Product Revenue', accountCategory: 'Revenue' as const, accountSubcategory: 'OPERATING_REVENUE', normalBalance: 'CREDIT', cashFlowCategory: 'OPERATING' },
      { id: ACCOUNT_IDS.SERVICE_REVENUE, accountNumber: '4100', accountName: 'Service Revenue', accountCategory: 'Revenue' as const, accountSubcategory: 'OPERATING_REVENUE', normalBalance: 'CREDIT', cashFlowCategory: 'OPERATING' },
      { id: ACCOUNT_IDS.OTHER_INCOME, accountNumber: '4200', accountName: 'Other Income', accountCategory: 'Revenue' as const, accountSubcategory: 'OTHER_INCOME', normalBalance: 'CREDIT', cashFlowCategory: 'OPERATING' },

      // COGS (5xxx)
      { id: ACCOUNT_IDS.COGS_PRODUCTS, accountNumber: '5000', accountName: 'Cost of Products Sold', accountCategory: 'COGS' as const, accountSubcategory: 'DIRECT_COSTS', normalBalance: 'DEBIT', cashFlowCategory: 'OPERATING' },
      { id: ACCOUNT_IDS.COGS_SERVICES, accountNumber: '5100', accountName: 'Cost of Services', accountCategory: 'COGS' as const, accountSubcategory: 'DIRECT_COSTS', normalBalance: 'DEBIT', cashFlowCategory: 'OPERATING' },

      // Operating Expenses (6xxx)
      { id: ACCOUNT_IDS.SALARIES_EXPENSE, accountNumber: '6000', accountName: 'Salaries & Wages', accountCategory: 'Expense' as const, accountSubcategory: 'OPERATING_EXPENSES', normalBalance: 'DEBIT', cashFlowCategory: 'OPERATING' },
      { id: ACCOUNT_IDS.RENT_EXPENSE, accountNumber: '6100', accountName: 'Rent Expense', accountCategory: 'Expense' as const, accountSubcategory: 'OPERATING_EXPENSES', normalBalance: 'DEBIT', cashFlowCategory: 'OPERATING' },
      { id: ACCOUNT_IDS.UTILITIES_EXPENSE, accountNumber: '6200', accountName: 'Utilities', accountCategory: 'Expense' as const, accountSubcategory: 'OPERATING_EXPENSES', normalBalance: 'DEBIT', cashFlowCategory: 'OPERATING' },
      { id: ACCOUNT_IDS.MARKETING_EXPENSE, accountNumber: '6300', accountName: 'Marketing & Advertising', accountCategory: 'Expense' as const, accountSubcategory: 'OPERATING_EXPENSES', normalBalance: 'DEBIT', cashFlowCategory: 'OPERATING' },
      { id: ACCOUNT_IDS.DEPRECIATION_EXPENSE, accountNumber: '6400', accountName: 'Depreciation Expense', accountCategory: 'Expense' as const, accountSubcategory: 'OPERATING_EXPENSES', normalBalance: 'DEBIT', cashFlowCategory: null },
      { id: ACCOUNT_IDS.OFFICE_SUPPLIES, accountNumber: '6500', accountName: 'Office Supplies', accountCategory: 'Expense' as const, accountSubcategory: 'OPERATING_EXPENSES', normalBalance: 'DEBIT', cashFlowCategory: 'OPERATING' },
      { id: ACCOUNT_IDS.INSURANCE_EXPENSE, accountNumber: '6600', accountName: 'Insurance Expense', accountCategory: 'Expense' as const, accountSubcategory: 'OPERATING_EXPENSES', normalBalance: 'DEBIT', cashFlowCategory: 'OPERATING' },
      { id: ACCOUNT_IDS.PROFESSIONAL_FEES, accountNumber: '6700', accountName: 'Professional Fees', accountCategory: 'Expense' as const, accountSubcategory: 'OPERATING_EXPENSES', normalBalance: 'DEBIT', cashFlowCategory: 'OPERATING' },
    ];

    for (const account of accountsData) {
      const existing = await db.select().from(accounts).where(eq(accounts.id, account.id));
      if (existing.length === 0) {
        await db.insert(accounts).values({
          ...account,
          organizationId: TEST_ORG_ID,
          isActive: true
        });
        console.log(`   ✓ Account ${account.accountNumber} - ${account.accountName}`);
      } else {
        console.log(`   ○ Account ${account.accountNumber} already exists`);
      }
    }

    // 5. Create GL Account Balances
    console.log('5. Creating account balances...');

    // Helper to create balance entry
    const createBalance = async (
      accountId: string,
      periodId: string,
      periodDebit: number,
      periodCredit: number,
      ytdDebit: number,
      ytdCredit: number
    ) => {
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

    // December 2024 Balances (realistic sample data)
    const dec2024Balances = [
      // Assets (Debits increase assets)
      { accountId: ACCOUNT_IDS.CASH, periodDebit: 125000, periodCredit: 0, ytdDebit: 1500000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.ACCOUNTS_RECEIVABLE, periodDebit: 85000, periodCredit: 0, ytdDebit: 850000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.INVENTORY, periodDebit: 45000, periodCredit: 0, ytdDebit: 540000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.PREPAID_EXPENSES, periodDebit: 8000, periodCredit: 0, ytdDebit: 96000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.FIXED_ASSETS, periodDebit: 250000, periodCredit: 0, ytdDebit: 250000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.ACCUM_DEPRECIATION, periodDebit: 0, periodCredit: 50000, ytdDebit: 0, ytdCredit: 50000 },

      // Liabilities (Credits increase liabilities)
      { accountId: ACCOUNT_IDS.ACCOUNTS_PAYABLE, periodDebit: 0, periodCredit: 42000, ytdDebit: 0, ytdCredit: 504000 },
      { accountId: ACCOUNT_IDS.ACCRUED_EXPENSES, periodDebit: 0, periodCredit: 18000, ytdDebit: 0, ytdCredit: 216000 },
      { accountId: ACCOUNT_IDS.DEFERRED_REVENUE, periodDebit: 0, periodCredit: 35000, ytdDebit: 0, ytdCredit: 420000 },
      { accountId: ACCOUNT_IDS.LONG_TERM_DEBT, periodDebit: 0, periodCredit: 150000, ytdDebit: 0, ytdCredit: 150000 },

      // Equity (Credits increase equity)
      { accountId: ACCOUNT_IDS.COMMON_STOCK, periodDebit: 0, periodCredit: 100000, ytdDebit: 0, ytdCredit: 100000 },
      { accountId: ACCOUNT_IDS.RETAINED_EARNINGS, periodDebit: 0, periodCredit: 250000, ytdDebit: 0, ytdCredit: 250000 },

      // Revenue (Credits increase revenue)
      { accountId: ACCOUNT_IDS.PRODUCT_REVENUE, periodDebit: 0, periodCredit: 180000, ytdDebit: 0, ytdCredit: 2160000 },
      { accountId: ACCOUNT_IDS.SERVICE_REVENUE, periodDebit: 0, periodCredit: 75000, ytdDebit: 0, ytdCredit: 900000 },
      { accountId: ACCOUNT_IDS.OTHER_INCOME, periodDebit: 0, periodCredit: 5000, ytdDebit: 0, ytdCredit: 60000 },

      // COGS (Debits increase COGS)
      { accountId: ACCOUNT_IDS.COGS_PRODUCTS, periodDebit: 90000, periodCredit: 0, ytdDebit: 1080000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.COGS_SERVICES, periodDebit: 30000, periodCredit: 0, ytdDebit: 360000, ytdCredit: 0 },

      // Operating Expenses (Debits increase expenses)
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
      const created = await createBalance(
        balance.accountId,
        TEST_PERIOD_2024_12_ID,
        balance.periodDebit,
        balance.periodCredit,
        balance.ytdDebit,
        balance.ytdCredit
      );
      if (created) balancesCreated++;
    }
    console.log(`   ✓ Created ${balancesCreated} account balances for December 2024`);

    // Also create November 2024 balances (for comparison)
    balancesCreated = 0;
    const nov2024Balances = dec2024Balances.map(b => ({
      ...b,
      periodDebit: b.periodDebit * 0.95, // Slightly lower than December
      periodCredit: b.periodCredit * 0.95,
      ytdDebit: b.ytdDebit - b.periodDebit, // YTD without December
      ytdCredit: b.ytdCredit - b.periodCredit
    }));

    for (const balance of nov2024Balances) {
      const created = await createBalance(
        balance.accountId,
        TEST_PERIOD_2024_11_ID,
        balance.periodDebit,
        balance.periodCredit,
        balance.ytdDebit,
        balance.ytdCredit
      );
      if (created) balancesCreated++;
    }
    console.log(`   ✓ Created ${balancesCreated} account balances for November 2024`);

    console.log('\n========================================');
    console.log('Financial test data seeding complete!');
    console.log('========================================\n');
    console.log('Test Data Summary:');
    console.log(`  Organization ID: ${TEST_ORG_ID}`);
    console.log(`  Subsidiary ID:   ${TEST_SUBSIDIARY_ID}`);
    console.log(`  Period IDs:`);
    console.log(`    - Nov 2024: ${TEST_PERIOD_2024_11_ID}`);
    console.log(`    - Dec 2024: ${TEST_PERIOD_2024_12_ID}`);
    console.log(`    - Jan 2025: ${TEST_PERIOD_2025_01_ID}`);
    console.log('\nTest with:');
    console.log(`  curl "http://localhost:3031/api/gl/reports/income-statement?periodId=${TEST_PERIOD_2024_12_ID}"`);
    console.log(`  curl "http://localhost:3031/api/gl/reports/balance-sheet?periodId=${TEST_PERIOD_2024_12_ID}"`);

  } catch (error) {
    console.error('Error seeding financial test data:', error);
    throw error;
  } finally {
    await db.$client.end();
  }
}

// Run the seed
seedFinancialTestData();
