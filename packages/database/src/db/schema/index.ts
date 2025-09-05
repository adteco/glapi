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

// Order-to-Cash transaction system uses existing business transaction system

// Note: Relations defined within schema files are automatically picked up by Drizzle
// when they are imported alongside their corresponding tables.

// 606 Ledger schemas
import * as subscriptions from './subscriptions';
import * as subscriptionItems from './subscription-items';
import * as invoices from './invoices';
import * as payments from './payments';
import * as revenueEnums from './revenue-enums';
import * as performanceObligationsNew from './performance-obligations';
import * as revenueSchedulesNew from './revenue-schedules';
import * as sspEvidenceNew from './ssp-evidence';
import * as contractSspAllocationsNew from './contract-ssp-allocations';
import * as revenueJournalEntriesNew from './revenue-journal-entries';
import * as kitComponents from './kit-components';

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
  // Order-to-Cash transaction system uses existing business transaction system
  // GL and transaction schemas
  ...transactionTypes,
  ...glTransactions,
  ...accountingPeriods,
  ...rlsAccessControl,
  ...taxCodes,
  ...activityCodes,
  // 606 Ledger schemas
  ...subscriptions,
  ...subscriptionItems,
  ...invoices,
  ...payments,
  ...revenueEnums,
  ...performanceObligationsNew,
  ...revenueSchedulesNew,
  ...sspEvidenceNew,
  ...contractSspAllocationsNew,
  ...revenueJournalEntriesNew,
  ...kitComponents
};

// Re-export specific types from new schemas
export type { Subscription, NewSubscription, UpdateSubscription } from './subscriptions';
export type { SubscriptionItem, NewSubscriptionItem, UpdateSubscriptionItem } from './subscription-items';
export type { Invoice, NewInvoice, UpdateInvoice } from './invoices';
export type { Payment, NewPayment, UpdatePayment } from './payments';