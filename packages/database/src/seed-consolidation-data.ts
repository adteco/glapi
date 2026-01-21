/**
 * Seed data for consolidation configuration
 *
 * This script creates a sample multi-subsidiary consolidation structure
 * with elimination rules and FX translation settings.
 *
 * Run with: npx tsx packages/database/src/seed-consolidation-data.ts
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

interface SeedOptions {
  organizationId: string;
  parentSubsidiaryId: string;
  consolidationCurrencyId: string;
  subsidiaryIds: string[];
  accountIds: {
    intercompanyReceivable: string;
    intercompanyPayable: string;
    intercompanyRevenue: string;
    intercompanyExpense: string;
    eliminationEntry: string;
    minorityInterest: string;
    cta: string; // Cumulative Translation Adjustment
  };
}

export async function seedConsolidationData(options: SeedOptions) {
  const {
    organizationId,
    parentSubsidiaryId,
    consolidationCurrencyId,
    subsidiaryIds,
    accountIds,
  } = options;

  console.log('Starting consolidation seed data...');

  try {
    // 1. Create consolidation group
    const groupResult = await db.execute(sql`
      INSERT INTO consolidation_groups (
        organization_id,
        name,
        code,
        description,
        parent_subsidiary_id,
        consolidation_currency_id,
        translation_method,
        effective_date,
        is_active
      ) VALUES (
        ${organizationId},
        'Global Consolidation Group',
        'GLOBAL-CONSOL',
        'Primary consolidation group for all subsidiaries',
        ${parentSubsidiaryId},
        ${consolidationCurrencyId},
        'CURRENT_RATE',
        '2025-01-01',
        true
      )
      ON CONFLICT (organization_id, code) DO NOTHING
      RETURNING id
    `);

    const groupId = (groupResult as any).rows?.[0]?.id;

    if (!groupId) {
      console.log('Consolidation group already exists or could not be created');
      return;
    }

    console.log(`Created consolidation group: ${groupId}`);

    // 2. Add subsidiaries as members
    for (let i = 0; i < subsidiaryIds.length; i++) {
      const subsidiaryId = subsidiaryIds[i];
      const ownershipPercent = i === 0 ? 100 : 80; // First subsidiary is 100%, others are 80%
      const method = ownershipPercent === 100 ? 'FULL' : 'PROPORTIONAL';

      await db.execute(sql`
        INSERT INTO consolidation_group_members (
          group_id,
          subsidiary_id,
          ownership_percent,
          voting_percent,
          consolidation_method,
          minority_interest_account_id,
          effective_date,
          sequence_number,
          is_active
        ) VALUES (
          ${groupId},
          ${subsidiaryId},
          ${ownershipPercent},
          ${ownershipPercent},
          ${method},
          ${method === 'PROPORTIONAL' ? accountIds.minorityInterest : null},
          '2025-01-01',
          ${i + 1},
          true
        )
        ON CONFLICT (group_id, subsidiary_id) DO NOTHING
      `);
    }

    console.log(`Added ${subsidiaryIds.length} subsidiaries to group`);

    // 3. Create elimination rules
    const eliminationRules = [
      {
        name: 'Intercompany AR/AP Elimination',
        eliminationType: 'INTERCOMPANY_RECEIVABLE',
        description: 'Eliminates intercompany receivables against payables',
        sourceAccountId: accountIds.intercompanyReceivable,
        targetAccountId: accountIds.intercompanyPayable,
        eliminationDebitAccountId: accountIds.eliminationEntry,
        eliminationCreditAccountId: accountIds.eliminationEntry,
        sequenceNumber: 10,
      },
      {
        name: 'Intercompany Revenue/Expense Elimination',
        eliminationType: 'INTERCOMPANY_REVENUE',
        description: 'Eliminates intercompany sales and purchases',
        sourceAccountId: accountIds.intercompanyRevenue,
        targetAccountId: accountIds.intercompanyExpense,
        eliminationDebitAccountId: accountIds.eliminationEntry,
        eliminationCreditAccountId: accountIds.eliminationEntry,
        sequenceNumber: 20,
      },
    ];

    for (const rule of eliminationRules) {
      await db.execute(sql`
        INSERT INTO elimination_rules (
          group_id,
          name,
          description,
          elimination_type,
          source_account_id,
          target_account_id,
          elimination_debit_account_id,
          elimination_credit_account_id,
          sequence_number,
          is_automatic,
          is_active,
          effective_date
        ) VALUES (
          ${groupId},
          ${rule.name},
          ${rule.description},
          ${rule.eliminationType},
          ${rule.sourceAccountId},
          ${rule.targetAccountId},
          ${rule.eliminationDebitAccountId},
          ${rule.eliminationCreditAccountId},
          ${rule.sequenceNumber},
          true,
          true,
          '2025-01-01'
        )
      `);
    }

    console.log(`Created ${eliminationRules.length} elimination rules`);

    // 4. Create FX translation rules
    const fxRules = [
      { accountType: 'ASSET', rateType: 'CURRENT', name: 'Assets - Current Rate' },
      { accountType: 'LIABILITY', rateType: 'CURRENT', name: 'Liabilities - Current Rate' },
      { accountType: 'EQUITY', rateType: 'HISTORICAL', name: 'Equity - Historical Rate' },
      { accountType: 'REVENUE', rateType: 'AVERAGE', name: 'Revenue - Average Rate' },
      { accountType: 'EXPENSE', rateType: 'AVERAGE', name: 'Expenses - Average Rate' },
    ];

    for (let i = 0; i < fxRules.length; i++) {
      const rule = fxRules[i];
      await db.execute(sql`
        INSERT INTO fx_translation_rules (
          group_id,
          name,
          account_type,
          rate_type,
          cta_account_id,
          sequence_number,
          is_active
        ) VALUES (
          ${groupId},
          ${rule.name},
          ${rule.accountType},
          ${rule.rateType},
          ${accountIds.cta},
          ${(i + 1) * 10},
          true
        )
      `);
    }

    console.log(`Created ${fxRules.length} FX translation rules`);

    // 5. Create intercompany account mappings
    await db.execute(sql`
      INSERT INTO intercompany_account_mappings (
        organization_id,
        name,
        description,
        source_account_id,
        target_account_id,
        elimination_debit_account_id,
        elimination_credit_account_id,
        is_active
      ) VALUES (
        ${organizationId},
        'IC Receivable to IC Payable',
        'Maps intercompany receivable to corresponding payable for elimination',
        ${accountIds.intercompanyReceivable},
        ${accountIds.intercompanyPayable},
        ${accountIds.eliminationEntry},
        ${accountIds.eliminationEntry},
        true
      )
      ON CONFLICT (organization_id, source_account_id, target_account_id) DO NOTHING
    `);

    console.log('Created intercompany account mapping');

    console.log('Consolidation seed data completed successfully!');

    return { groupId };
  } catch (error) {
    console.error('Error seeding consolidation data:', error);
    throw error;
  }
}

// Standalone execution
async function main() {
  console.log('====================================');
  console.log('Consolidation Data Seeding');
  console.log('====================================');
  console.log('');
  console.log('This script requires existing:');
  console.log('  - Organization');
  console.log('  - Subsidiaries');
  console.log('  - Currency');
  console.log('  - Accounts for IC transactions');
  console.log('');
  console.log('To use, import and call seedConsolidationData() with the required IDs.');
  console.log('');
  console.log('Example:');
  console.log('');
  console.log('  import { seedConsolidationData } from "./seed-consolidation-data";');
  console.log('  ');
  console.log('  await seedConsolidationData({');
  console.log('    organizationId: "your-org-id",');
  console.log('    parentSubsidiaryId: "parent-sub-id",');
  console.log('    consolidationCurrencyId: "usd-currency-id",');
  console.log('    subsidiaryIds: ["sub1-id", "sub2-id", "sub3-id"],');
  console.log('    accountIds: {');
  console.log('      intercompanyReceivable: "...",');
  console.log('      intercompanyPayable: "...",');
  console.log('      intercompanyRevenue: "...",');
  console.log('      intercompanyExpense: "...",');
  console.log('      eliminationEntry: "...",');
  console.log('      minorityInterest: "...",');
  console.log('      cta: "...",');
  console.log('    },');
  console.log('  });');
  console.log('');

  await db.$client.end();
}

main();
