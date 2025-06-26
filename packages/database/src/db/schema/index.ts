import * as organizations from './organizations';
import * as users from './users';
import * as products from './products';
import * as contracts from './contracts';
import * as contractLineItems from './contract_line_items';
import * as performanceObligations from './performance_obligations';
import * as recognitionPatterns from './recognition_patterns';
import * as revenueSchedules from './revenue_schedules';
import * as sspEvidence from './ssp_evidence';
import * as contractSspAllocations from './contract_ssp_allocations';
import * as revenueJournalEntries from './revenue_journal_entries';
import * as departments from './departments';
import * as locations from './locations';
import * as classes from './classes';
import * as subsidiaries from './subsidiaries';
import * as currencies from './currencies';
import * as transactionLines from './transactionLines';
import * as accounts from './accounts';
import * as entities from './entities';
import * as addresses from './addresses';
import * as transactionTypes from './transaction-types';
import * as glTransactions from './gl-transactions';
import * as accountingPeriods from './accounting-periods';
import * as rlsAccessControl from './rls-access-control';
import * as taxCodes from './tax-codes';
import * as activityCodes from './activity-codes';

// Items system imports
import * as unitsOfMeasure from './units-of-measure';
import * as itemCategories from './item-categories';
import * as items from './items';
import * as pricing from './pricing';
import * as warehouses from './warehouses';
import * as vendorItems from './vendor-items';
import * as inventoryTracking from './inventory-tracking';
import * as assembliesKits from './assemblies-kits';
import * as itemAuditLog from './item-audit-log';

// Note: Relations defined within schema files are automatically picked up by Drizzle
// when they are imported alongside their corresponding tables.

// Temporarily comment out GL tables to test
import * as testGl from './test-gl';

export const schema = {
  ...organizations,
  ...users,
  ...products,
  ...contracts,
  ...contractLineItems,
  ...performanceObligations,
  ...recognitionPatterns,
  ...revenueSchedules,
  ...sspEvidence,
  ...contractSspAllocations,
  ...revenueJournalEntries,
  ...departments,
  ...locations,
  ...classes,
  ...subsidiaries,
  ...currencies,
  ...transactionLines,
  ...accounts,
  ...entities,
  ...addresses,
  ...testGl,
  // Items system schemas
  ...unitsOfMeasure,
  ...itemCategories,
  ...items,
  ...pricing,
  ...warehouses,
  ...vendorItems,
  ...inventoryTracking,
  ...assembliesKits,
  ...itemAuditLog,
  // GL and transaction schemas
  ...transactionTypes,
  ...glTransactions,
  ...accountingPeriods,
  ...rlsAccessControl,
  ...taxCodes,
  ...activityCodes
};