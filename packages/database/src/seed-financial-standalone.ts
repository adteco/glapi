/**
 * Standalone Seed Script for Test Financial Data
 * Uses postgres.js for better connection handling
 *
 * Run with: pnpm --filter @glapi/database seed:financial-standalone
 */

import postgres from 'postgres';

// Connection using postgres.js with explicit parameters
const sql = postgres({
  host: 'aws-0-us-east-2.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  username: 'postgres.<redacted-user>',
  password: '<redacted-password>',
  ssl: 'require',
  prepare: false // Required for connection pooler
});

// Helper to make queries compatible
const pool = {
  connect: async () => ({
    query: async (text: string, params?: any[]) => {
      // Convert $1, $2 placeholders to postgres.js syntax
      const result = await sql.unsafe(text, params || []);
      return { rows: result };
    },
    release: () => {}
  }),
  end: () => sql.end()
};

// Fixed UUIDs for consistent test data
const TEST_ORG_ID = 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2';
const TEST_SUBSIDIARY_ID = 'e7a1c3b5-2d4f-4a6e-8b9c-1d2e3f4a5b6c';
const TEST_PERIOD_2024_12_ID = 'f8b2d4c6-3e5a-4b7d-9c0e-2f3a4b5c6d7e';
const TEST_PERIOD_2024_11_ID = 'a9c3e5d7-4f6b-5c8e-0d1f-3a4b5c6d7e8f';
const TEST_PERIOD_2025_01_ID = 'b0d4f6e8-5a7c-6d9f-1e2a-4b5c6d7e8f9a';

// Account IDs
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

  const client = await pool.connect();

  try {
    // 1. Create Organization
    console.log('1. Creating organization...');
    const orgExists = await client.query('SELECT id FROM organizations WHERE id = $1', [TEST_ORG_ID]);

    if (orgExists.rows.length === 0) {
      await client.query(`
        INSERT INTO organizations (id, name, stytch_org_id, slug, settings)
        VALUES ($1, $2, $3, $4, $5)
      `, [TEST_ORG_ID, 'Test Development Organization', 'org_development', 'test-dev-org', JSON.stringify({ currency: 'USD', fiscalYearStart: '01-01' })]);
      console.log('   ✓ Organization created');
    } else {
      console.log('   ○ Organization already exists');
    }

    // 2. Create Subsidiary
    console.log('2. Creating subsidiary...');
    const subExists = await client.query('SELECT id FROM subsidiaries WHERE id = $1', [TEST_SUBSIDIARY_ID]);

    if (subExists.rows.length === 0) {
      await client.query(`
        INSERT INTO subsidiaries (id, organization_id, name, code, description, country_code, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [TEST_SUBSIDIARY_ID, TEST_ORG_ID, 'Main Subsidiary', 'MAIN', 'Primary operating subsidiary', 'US', true]);
      console.log('   ✓ Subsidiary created');
    } else {
      console.log('   ○ Subsidiary already exists');
    }

    // 3. Create Accounting Periods
    console.log('3. Creating accounting periods...');
    const periods = [
      { id: TEST_PERIOD_2024_11_ID, name: 'November 2024', year: '2024', num: 11, start: '2024-11-01', end: '2024-11-30', status: 'CLOSED' },
      { id: TEST_PERIOD_2024_12_ID, name: 'December 2024', year: '2024', num: 12, start: '2024-12-01', end: '2024-12-31', status: 'OPEN' },
      { id: TEST_PERIOD_2025_01_ID, name: 'January 2025', year: '2025', num: 1, start: '2025-01-01', end: '2025-01-31', status: 'OPEN' }
    ];

    for (const p of periods) {
      const exists = await client.query('SELECT id FROM accounting_periods WHERE id = $1', [p.id]);
      if (exists.rows.length === 0) {
        await client.query(`
          INSERT INTO accounting_periods (id, subsidiary_id, period_name, fiscal_year, period_number, start_date, end_date, period_type, status, is_adjustment_period)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [p.id, TEST_SUBSIDIARY_ID, p.name, p.year, p.num, p.start, p.end, 'MONTH', p.status, false]);
        console.log(`   ✓ Period "${p.name}" created`);
      } else {
        console.log(`   ○ Period "${p.name}" already exists`);
      }
    }

    // 4. Create Chart of Accounts
    console.log('4. Creating chart of accounts...');
    const accountsData = [
      // Assets
      { id: ACCOUNT_IDS.CASH, num: '1000', name: 'Cash and Cash Equivalents', cat: 'Asset', subcat: 'CURRENT_ASSETS', normal: 'DEBIT' },
      { id: ACCOUNT_IDS.ACCOUNTS_RECEIVABLE, num: '1100', name: 'Accounts Receivable', cat: 'Asset', subcat: 'CURRENT_ASSETS', normal: 'DEBIT' },
      { id: ACCOUNT_IDS.INVENTORY, num: '1200', name: 'Inventory', cat: 'Asset', subcat: 'CURRENT_ASSETS', normal: 'DEBIT' },
      { id: ACCOUNT_IDS.PREPAID_EXPENSES, num: '1300', name: 'Prepaid Expenses', cat: 'Asset', subcat: 'CURRENT_ASSETS', normal: 'DEBIT' },
      { id: ACCOUNT_IDS.FIXED_ASSETS, num: '1500', name: 'Property, Plant & Equipment', cat: 'Asset', subcat: 'FIXED_ASSETS', normal: 'DEBIT' },
      { id: ACCOUNT_IDS.ACCUM_DEPRECIATION, num: '1600', name: 'Accumulated Depreciation', cat: 'Asset', subcat: 'FIXED_ASSETS', normal: 'CREDIT' },

      // Liabilities
      { id: ACCOUNT_IDS.ACCOUNTS_PAYABLE, num: '2000', name: 'Accounts Payable', cat: 'Liability', subcat: 'CURRENT_LIABILITIES', normal: 'CREDIT' },
      { id: ACCOUNT_IDS.ACCRUED_EXPENSES, num: '2100', name: 'Accrued Expenses', cat: 'Liability', subcat: 'CURRENT_LIABILITIES', normal: 'CREDIT' },
      { id: ACCOUNT_IDS.DEFERRED_REVENUE, num: '2200', name: 'Deferred Revenue', cat: 'Liability', subcat: 'CURRENT_LIABILITIES', normal: 'CREDIT' },
      { id: ACCOUNT_IDS.LONG_TERM_DEBT, num: '2500', name: 'Long-Term Debt', cat: 'Liability', subcat: 'LONG_TERM_LIABILITIES', normal: 'CREDIT' },

      // Equity
      { id: ACCOUNT_IDS.COMMON_STOCK, num: '3000', name: 'Common Stock', cat: 'Equity', subcat: 'CAPITAL', normal: 'CREDIT' },
      { id: ACCOUNT_IDS.RETAINED_EARNINGS, num: '3100', name: 'Retained Earnings', cat: 'Equity', subcat: 'RETAINED_EARNINGS', normal: 'CREDIT' },

      // Revenue
      { id: ACCOUNT_IDS.PRODUCT_REVENUE, num: '4000', name: 'Product Revenue', cat: 'Revenue', subcat: 'OPERATING_REVENUE', normal: 'CREDIT' },
      { id: ACCOUNT_IDS.SERVICE_REVENUE, num: '4100', name: 'Service Revenue', cat: 'Revenue', subcat: 'OPERATING_REVENUE', normal: 'CREDIT' },
      { id: ACCOUNT_IDS.OTHER_INCOME, num: '4200', name: 'Other Income', cat: 'Revenue', subcat: 'OTHER_INCOME', normal: 'CREDIT' },

      // COGS
      { id: ACCOUNT_IDS.COGS_PRODUCTS, num: '5000', name: 'Cost of Products Sold', cat: 'COGS', subcat: 'DIRECT_COSTS', normal: 'DEBIT' },
      { id: ACCOUNT_IDS.COGS_SERVICES, num: '5100', name: 'Cost of Services', cat: 'COGS', subcat: 'DIRECT_COSTS', normal: 'DEBIT' },

      // Expenses
      { id: ACCOUNT_IDS.SALARIES_EXPENSE, num: '6000', name: 'Salaries & Wages', cat: 'Expense', subcat: 'OPERATING_EXPENSES', normal: 'DEBIT' },
      { id: ACCOUNT_IDS.RENT_EXPENSE, num: '6100', name: 'Rent Expense', cat: 'Expense', subcat: 'OPERATING_EXPENSES', normal: 'DEBIT' },
      { id: ACCOUNT_IDS.UTILITIES_EXPENSE, num: '6200', name: 'Utilities', cat: 'Expense', subcat: 'OPERATING_EXPENSES', normal: 'DEBIT' },
      { id: ACCOUNT_IDS.MARKETING_EXPENSE, num: '6300', name: 'Marketing & Advertising', cat: 'Expense', subcat: 'OPERATING_EXPENSES', normal: 'DEBIT' },
      { id: ACCOUNT_IDS.DEPRECIATION_EXPENSE, num: '6400', name: 'Depreciation Expense', cat: 'Expense', subcat: 'OPERATING_EXPENSES', normal: 'DEBIT' },
      { id: ACCOUNT_IDS.OFFICE_SUPPLIES, num: '6500', name: 'Office Supplies', cat: 'Expense', subcat: 'OPERATING_EXPENSES', normal: 'DEBIT' },
      { id: ACCOUNT_IDS.INSURANCE_EXPENSE, num: '6600', name: 'Insurance Expense', cat: 'Expense', subcat: 'OPERATING_EXPENSES', normal: 'DEBIT' },
      { id: ACCOUNT_IDS.PROFESSIONAL_FEES, num: '6700', name: 'Professional Fees', cat: 'Expense', subcat: 'OPERATING_EXPENSES', normal: 'DEBIT' },
    ];

    let accountsCreated = 0;
    for (const a of accountsData) {
      const exists = await client.query('SELECT id FROM accounts WHERE id = $1', [a.id]);
      if (exists.rows.length === 0) {
        await client.query(`
          INSERT INTO accounts (id, organization_id, account_number, account_name, account_category, account_subcategory, normal_balance, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [a.id, TEST_ORG_ID, a.num, a.name, a.cat, a.subcat, a.normal, true]);
        accountsCreated++;
      }
    }
    console.log(`   ✓ Created ${accountsCreated} accounts (${accountsData.length - accountsCreated} already existed)`);

    // 5. Create GL Account Balances
    console.log('5. Creating account balances...');

    const createBalance = async (accountId: string, periodId: string, pDebit: number, pCredit: number, ytdDebit: number, ytdCredit: number) => {
      const exists = await client.query(
        'SELECT id FROM gl_account_balances WHERE account_id = $1 AND period_id = $2 AND subsidiary_id = $3',
        [accountId, periodId, TEST_SUBSIDIARY_ID]
      );

      if (exists.rows.length === 0) {
        await client.query(`
          INSERT INTO gl_account_balances (
            account_id, subsidiary_id, period_id, currency_code,
            beginning_balance_debit, beginning_balance_credit,
            period_debit_amount, period_credit_amount,
            ending_balance_debit, ending_balance_credit,
            ytd_debit_amount, ytd_credit_amount,
            base_beginning_balance_debit, base_beginning_balance_credit,
            base_period_debit_amount, base_period_credit_amount,
            base_ending_balance_debit, base_ending_balance_credit,
            base_ytd_debit_amount, base_ytd_credit_amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        `, [
          accountId, TEST_SUBSIDIARY_ID, periodId, 'USD',
          0, 0, pDebit, pCredit, pDebit, pCredit, ytdDebit, ytdCredit,
          0, 0, pDebit, pCredit, pDebit, pCredit, ytdDebit, ytdCredit
        ]);
        return true;
      }
      return false;
    };

    // December 2024 Balances
    const dec2024Balances = [
      // Assets
      { accountId: ACCOUNT_IDS.CASH, pDebit: 125000, pCredit: 0, ytdDebit: 1500000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.ACCOUNTS_RECEIVABLE, pDebit: 85000, pCredit: 0, ytdDebit: 850000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.INVENTORY, pDebit: 45000, pCredit: 0, ytdDebit: 540000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.PREPAID_EXPENSES, pDebit: 8000, pCredit: 0, ytdDebit: 96000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.FIXED_ASSETS, pDebit: 250000, pCredit: 0, ytdDebit: 250000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.ACCUM_DEPRECIATION, pDebit: 0, pCredit: 50000, ytdDebit: 0, ytdCredit: 50000 },

      // Liabilities
      { accountId: ACCOUNT_IDS.ACCOUNTS_PAYABLE, pDebit: 0, pCredit: 42000, ytdDebit: 0, ytdCredit: 504000 },
      { accountId: ACCOUNT_IDS.ACCRUED_EXPENSES, pDebit: 0, pCredit: 18000, ytdDebit: 0, ytdCredit: 216000 },
      { accountId: ACCOUNT_IDS.DEFERRED_REVENUE, pDebit: 0, pCredit: 35000, ytdDebit: 0, ytdCredit: 420000 },
      { accountId: ACCOUNT_IDS.LONG_TERM_DEBT, pDebit: 0, pCredit: 150000, ytdDebit: 0, ytdCredit: 150000 },

      // Equity
      { accountId: ACCOUNT_IDS.COMMON_STOCK, pDebit: 0, pCredit: 100000, ytdDebit: 0, ytdCredit: 100000 },
      { accountId: ACCOUNT_IDS.RETAINED_EARNINGS, pDebit: 0, pCredit: 250000, ytdDebit: 0, ytdCredit: 250000 },

      // Revenue
      { accountId: ACCOUNT_IDS.PRODUCT_REVENUE, pDebit: 0, pCredit: 180000, ytdDebit: 0, ytdCredit: 2160000 },
      { accountId: ACCOUNT_IDS.SERVICE_REVENUE, pDebit: 0, pCredit: 75000, ytdDebit: 0, ytdCredit: 900000 },
      { accountId: ACCOUNT_IDS.OTHER_INCOME, pDebit: 0, pCredit: 5000, ytdDebit: 0, ytdCredit: 60000 },

      // COGS
      { accountId: ACCOUNT_IDS.COGS_PRODUCTS, pDebit: 90000, pCredit: 0, ytdDebit: 1080000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.COGS_SERVICES, pDebit: 30000, pCredit: 0, ytdDebit: 360000, ytdCredit: 0 },

      // Expenses
      { accountId: ACCOUNT_IDS.SALARIES_EXPENSE, pDebit: 65000, pCredit: 0, ytdDebit: 780000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.RENT_EXPENSE, pDebit: 12000, pCredit: 0, ytdDebit: 144000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.UTILITIES_EXPENSE, pDebit: 3500, pCredit: 0, ytdDebit: 42000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.MARKETING_EXPENSE, pDebit: 8000, pCredit: 0, ytdDebit: 96000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.DEPRECIATION_EXPENSE, pDebit: 4167, pCredit: 0, ytdDebit: 50004, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.OFFICE_SUPPLIES, pDebit: 1500, pCredit: 0, ytdDebit: 18000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.INSURANCE_EXPENSE, pDebit: 2500, pCredit: 0, ytdDebit: 30000, ytdCredit: 0 },
      { accountId: ACCOUNT_IDS.PROFESSIONAL_FEES, pDebit: 5000, pCredit: 0, ytdDebit: 60000, ytdCredit: 0 },
    ];

    let balancesCreated = 0;
    for (const b of dec2024Balances) {
      if (await createBalance(b.accountId, TEST_PERIOD_2024_12_ID, b.pDebit, b.pCredit, b.ytdDebit, b.ytdCredit)) {
        balancesCreated++;
      }
    }
    console.log(`   ✓ Created ${balancesCreated} balances for December 2024`);

    // November 2024 balances (for comparison)
    balancesCreated = 0;
    for (const b of dec2024Balances) {
      const novBalance = {
        ...b,
        pDebit: Math.round(b.pDebit * 0.95),
        pCredit: Math.round(b.pCredit * 0.95),
        ytdDebit: b.ytdDebit - b.pDebit,
        ytdCredit: b.ytdCredit - b.pCredit
      };
      if (await createBalance(novBalance.accountId, TEST_PERIOD_2024_11_ID, novBalance.pDebit, novBalance.pCredit, novBalance.ytdDebit, novBalance.ytdCredit)) {
        balancesCreated++;
      }
    }
    console.log(`   ✓ Created ${balancesCreated} balances for November 2024`);

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
    client.release();
    await pool.end();
  }
}

seedFinancialTestData();
