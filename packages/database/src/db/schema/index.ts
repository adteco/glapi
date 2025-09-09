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

// Contract modification schemas
import * as contractModifications from './contract-modifications';
import * as modificationLineItems from './modification-line-items';
import * as catchUpAdjustments from './catch-up-adjustments';
import * as glAccountMappings from './gl-account-mappings';
import * as revenueForecastingSchemas from './revenue-forecasting';
import * as sspAnalyticsSchemas from './ssp-analytics';

// Additional analytics schemas
import * as churnPredictions from './churn-predictions';
import * as cohortAnalysisSchemas from './cohort-analysis';
import * as scenarioAnalysisSchemas from './scenario-analysis';
import * as journalEntryBatchSchemas from './journal-entry-batches';

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
  ...kitComponents,
  // Contract modification schemas
  ...contractModifications,
  ...modificationLineItems,
  ...catchUpAdjustments,
  ...glAccountMappings,
  ...revenueForecastingSchemas,
  ...sspAnalyticsSchemas,
  // Additional analytics schemas
  ...churnPredictions,
  ...cohortAnalysisSchemas,
  ...scenarioAnalysisSchemas,
  ...journalEntryBatchSchemas
};

// Re-export specific types from new schemas
export type { Subscription, NewSubscription, UpdateSubscription } from './subscriptions';
export type { SubscriptionItem, NewSubscriptionItem, UpdateSubscriptionItem } from './subscription-items';
export type { Invoice, NewInvoice, UpdateInvoice } from './invoices';
export type { Payment, NewPayment, UpdatePayment } from './payments';
export type { PerformanceObligation, NewPerformanceObligation } from './performance-obligations';
export type { RevenueSchedule, NewRevenueSchedule } from './revenue-schedules';
export type { SspEvidence as SSPEvidence, NewSspEvidence as NewSSPEvidence } from './ssp-evidence';
export type { ContractSspAllocation as ContractSSPAllocation, NewContractSspAllocation as NewContractSSPAllocation } from './contract-ssp-allocations';
export type { RevenueJournalEntry, NewRevenueJournalEntry } from './revenue-journal-entries';

// Re-export tables from new schemas with correct names
export { performanceObligations } from './performance-obligations';
export { revenueSchedules } from './revenue-schedules';
export { sspEvidence } from './ssp-evidence';
export { contractSspAllocations } from './contract-ssp-allocations';
export { revenueJournalEntries } from './revenue-journal-entries';
export { items } from './items';
export { kitComponents } from './kit-components';
export type { KitComponent } from './kit-components';
export { subscriptions } from './subscriptions';
export { subscriptionItems } from './subscription-items';
export { invoices } from './invoices';
export { payments } from './payments';

// Re-export contract modification schemas
export { 
  contractModifications, 
  modificationMethodEnum as ModificationMethod,
  modificationTypeEnum as ModificationType,
  modificationStatusEnum as ModificationStatus
} from './contract-modifications';
export type { 
  ContractModification,
  NewContractModification,
  UpdateContractModification
} from './contract-modifications';
export { modificationLineItems } from './modification-line-items';
export type { 
  ModificationLineItem,
  NewModificationLineItem
} from './modification-line-items';
export { catchUpAdjustments } from './catch-up-adjustments';
export type {
  CatchUpAdjustment,
  NewCatchUpAdjustment
} from './catch-up-adjustments';

// Re-export SSP analytics schemas
export {
  sspCalculationRuns,
  vsoeEvidence,
  sspPricingBands,
  sspExceptions,
  CalculationMethods,
  ExceptionTypes,
  ExceptionSeverity,
  RunStatus
} from './ssp-analytics';
export type {
  SSPCalculationRun,
  NewSSPCalculationRun,
  VSOEEvidence,
  NewVSOEEvidence,
  SSPPricingBand,
  NewSSPPricingBand,
  SSPException,
  NewSSPException
} from './ssp-analytics';

// Re-export GL account mappings
export { 
  glAccountMappings,
  journalEntryBatches,
  AccountTypes,
  TransactionTypes,
  ExternalSystems,
  BatchStatuses
} from './gl-account-mappings';
export type {
  GLAccountMapping,
  NewGLAccountMapping,
  JournalEntryBatch,
  NewJournalEntryBatch
} from './gl-account-mappings';

// Re-export forecasting schemas
export {
  revenueForecastRuns,
  revenueForecastDetails,
  forecastModelEnum as ForecastModel
} from './revenue-forecasting';
export type {
  RevenueForecastRun,
  NewRevenueForecastRun,
  RevenueForecastDetail,
  NewRevenueForecastDetail
} from './revenue-forecasting';

// Re-export analytics schemas
export { churnPredictions } from './churn-predictions';
export type { ChurnPrediction, NewChurnPrediction } from './churn-predictions';

export { cohortAnalysis, deferredRevenueRollforward } from './cohort-analysis';
export type { 
  CohortAnalysis, 
  NewCohortAnalysis,
  DeferredRevenueRollforward,
  NewDeferredRevenueRollforward
} from './cohort-analysis';

export { scenarioAnalysis } from './scenario-analysis';
export type { ScenarioAnalysis, NewScenarioAnalysis } from './scenario-analysis';

// Re-export modification approval history
export { modificationApprovalHistory } from './contract-modifications';
export type { 
  ModificationApprovalHistory,
  NewModificationApprovalHistory
} from './contract-modifications';