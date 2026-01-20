/**
 * GLAPI SDK Example: Working with Transactions
 *
 * This example demonstrates creating and managing business transactions.
 *
 * Run with: npx tsx examples/02-transactions.ts
 */

import { GlapiClient } from '@glapi/sdk';

async function main() {
  // Initialize client
  const client = new GlapiClient({
    baseUrl: process.env.GLAPI_BASE_URL || 'http://localhost:3031/api',
    token: process.env.GLAPI_TOKEN,
  });

  console.log('GLAPI SDK - Transaction Examples');
  console.log('=================================\n');

  try {
    // =========================================================================
    // Example 1: List existing transactions
    // =========================================================================
    console.log('1. Listing transactions...');
    const transactions = await client.transactions.list();
    console.log(`   Found transactions:`, transactions);
    console.log();

    // =========================================================================
    // Example 2: Create a journal entry
    // =========================================================================
    console.log('2. Creating a journal entry...');
    const journalEntry = {
      type: 'JOURNAL_ENTRY',
      date: new Date().toISOString().split('T')[0],
      description: 'Monthly depreciation - Equipment',
      memo: 'Auto-generated depreciation entry',
      lines: [
        {
          accountId: 'depreciation-expense',
          debit: 1500.0,
          credit: 0,
          description: 'Depreciation expense - Office equipment',
        },
        {
          accountId: 'accumulated-depreciation',
          debit: 0,
          credit: 1500.0,
          description: 'Accumulated depreciation - Office equipment',
        },
      ],
    };
    console.log('   Would create:', JSON.stringify(journalEntry, null, 2));
    // Uncomment to actually create:
    // const created = await client.transactions.create(journalEntry);
    // console.log('   Created:', created);
    console.log();

    // =========================================================================
    // Example 3: Create a sales transaction
    // =========================================================================
    console.log('3. Creating a sales transaction...');
    const salesTransaction = {
      type: 'SALES_INVOICE',
      customerId: 'customer-123',
      date: new Date().toISOString().split('T')[0],
      description: 'Professional services - January 2026',
      lines: [
        {
          accountId: 'revenue-services',
          debit: 0,
          credit: 5000.0,
          description: 'Consulting revenue',
        },
        {
          accountId: 'accounts-receivable',
          debit: 5000.0,
          credit: 0,
          description: 'AR - Customer ABC',
        },
      ],
    };
    console.log('   Would create:', JSON.stringify(salesTransaction, null, 2));
    console.log();

    // =========================================================================
    // Example 4: Create a purchase transaction
    // =========================================================================
    console.log('4. Creating a purchase transaction...');
    const purchaseTransaction = {
      type: 'PURCHASE_INVOICE',
      vendorId: 'vendor-456',
      date: new Date().toISOString().split('T')[0],
      description: 'Office supplies - January 2026',
      lines: [
        {
          accountId: 'office-supplies-expense',
          debit: 250.0,
          credit: 0,
          description: 'Office supplies',
        },
        {
          accountId: 'accounts-payable',
          debit: 0,
          credit: 250.0,
          description: 'AP - Supplier XYZ',
        },
      ],
    };
    console.log('   Would create:', JSON.stringify(purchaseTransaction, null, 2));
    console.log();

    console.log('Transaction examples completed successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
