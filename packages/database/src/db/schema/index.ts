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
import * as projects from './projects';
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
import * as glJournalEntrySchemas from './gl-journal-entries';

// Event sourcing schemas
import * as eventStoreSchemas from './event-store';

// Audit logging schemas
import * as auditLogSchemas from './audit-logs';

// Time tracking schemas
import * as timeEntriesSchemas from './time-entries';

// Schedule of Values and Pay Applications schemas
import * as scheduleOfValuesSchemas from './schedule-of-values';
import * as payApplicationsSchemas from './pay-applications';

// Sales Orders (Order-to-Cash)
import * as salesOrdersSchemas from './sales-orders';

// Close Management schemas
import * as closeManagementSchemas from './close-management';

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
  ...projects,
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
  ...journalEntryBatchSchemas,
  ...glJournalEntrySchemas,
  // Event sourcing schemas
  ...eventStoreSchemas,
  // Audit logging schemas
  ...auditLogSchemas,
  // Time tracking schemas
  ...timeEntriesSchemas,
  // Schedule of Values and Pay Applications schemas
  ...scheduleOfValuesSchemas,
  ...payApplicationsSchemas,
  // Sales Orders (Order-to-Cash)
  ...salesOrdersSchemas,
  // Close Management schemas
  ...closeManagementSchemas,
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
  glPeriodEndBatches,
  AccountTypes,
  TransactionTypes,
  ExternalSystems,
  GLBatchStatuses
} from './gl-account-mappings';
export type {
  GLAccountMapping,
  NewGLAccountMapping,
  GLPeriodEndBatch,
  NewGLPeriodEndBatch
} from './gl-account-mappings';

// Re-export journal entry batches
export { journalEntryBatches, BatchStatuses } from './journal-entry-batches';
export type { JournalEntryBatch, NewJournalEntryBatch } from './journal-entry-batches';

// Re-export business transactions
export { businessTransactions, businessTransactionLines, transactionTypes } from './transaction-types';

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

// Re-export GL journal entries
export { glJournalEntries, GLJournalStatus } from './gl-journal-entries';
export type { GLJournalEntry, NewGLJournalEntry } from './gl-journal-entries';

// Re-export accounting periods
export { accountingPeriods } from './accounting-periods';

// Re-export GL transaction tables
export {
  glTransactions,
  glTransactionLines,
  glPostingRules,
  glAccountBalances,
  glAuditTrail,
} from './gl-transactions';

// Re-export event store schemas
export {
  eventStore,
  eventOutbox,
  eventProjections,
  eventCategoryEnum,
  outboxStatusEnum,
  EventCategory,
  OutboxStatus,
} from './event-store';
export type {
  EventStoreRecord,
  NewEventStoreRecord,
  EventOutboxRecord,
  NewEventOutboxRecord,
  EventProjectionRecord,
  NewEventProjectionRecord,
  BaseEvent,
  EventCategoryType,
  OutboxStatusType,
} from './event-store';

// Re-export unified audit log schemas
export {
  unifiedAuditLog,
  auditEvidencePackages,
  auditActionTypeEnum,
  auditSeverityEnum,
  AuditActionType,
  AuditSeverity,
} from './audit-logs';
export type {
  UnifiedAuditLogRecord,
  NewUnifiedAuditLogRecord,
  AuditEvidencePackageRecord,
  NewAuditEvidencePackageRecord,
  AuditActionTypeValue,
  AuditSeverityValue,
} from './audit-logs';

// Re-export time tracking schemas
export {
  timeEntries,
  laborCostRates,
  employeeProjectAssignments,
  timeEntryApprovals,
  timeEntryBatches,
  timeEntryStatusEnum,
  timeEntryTypeEnum,
  approvalActionEnum,
} from './time-entries';
export type {
  TimeEntry,
  NewTimeEntry,
  UpdateTimeEntry,
  LaborCostRate,
  NewLaborCostRate,
  UpdateLaborCostRate,
  EmployeeProjectAssignment,
  NewEmployeeProjectAssignment,
  UpdateEmployeeProjectAssignment,
  TimeEntryApproval,
  NewTimeEntryApproval,
  TimeEntryBatch,
  NewTimeEntryBatch,
  UpdateTimeEntryBatch,
  TimeEntryStatus,
  TimeEntryType,
  ApprovalAction,
} from './time-entries';

// Re-export Schedule of Values schemas
export {
  projectScheduleOfValues,
  scheduleOfValueLines,
  sovChangeOrders,
  sovChangeOrderLines,
  SOV_STATUS,
  SOV_LINE_TYPE,
} from './schedule-of-values';
export type {
  ProjectScheduleOfValues,
  NewProjectScheduleOfValues,
  ScheduleOfValueLine,
  NewScheduleOfValueLine,
  SovChangeOrder,
  NewSovChangeOrder,
  SovChangeOrderLine,
  NewSovChangeOrderLine,
  SovStatus,
  SovLineType,
} from './schedule-of-values';

// Re-export Pay Applications schemas
export {
  payApplications,
  payApplicationLines,
  retainageReleases,
  retainageReleaseLines,
  payAppApprovalHistory,
  PAY_APP_STATUS,
  PAY_APP_TYPE,
} from './pay-applications';
export type {
  PayApplication,
  NewPayApplication,
  PayApplicationLine,
  NewPayApplicationLine,
  RetainageRelease,
  NewRetainageRelease,
  RetainageReleaseLine,
  NewRetainageReleaseLine,
  PayAppApprovalHistory,
  NewPayAppApprovalHistory,
  PayAppStatus,
  PayAppType,
} from './pay-applications';

// Re-export Sales Order schemas (Order-to-Cash)
export {
  salesOrders,
  salesOrderLines,
  salesOrderApprovalHistory,
  salesOrderInvoices,
  salesOrderStatusEnum,
  approvalActionTypeEnum,
  SalesOrderStatus,
  ApprovalActionType,
  VALID_SALES_ORDER_TRANSITIONS,
} from './sales-orders';
export type {
  SalesOrder,
  NewSalesOrder,
  UpdateSalesOrder,
  SalesOrderLine,
  NewSalesOrderLine,
  UpdateSalesOrderLine,
  SalesOrderApprovalHistoryRecord,
  NewSalesOrderApprovalHistoryRecord,
  SalesOrderInvoiceLink,
  NewSalesOrderInvoiceLink,
  SalesOrderStatusValue,
  ApprovalActionTypeValue,
} from './sales-orders';

// Re-export Close Management schemas
export {
  closeTaskTemplates,
  closeChecklists,
  closeTasks,
  varianceThresholds,
  varianceAlerts,
  tieoutTemplates,
  tieoutInstances,
  closeNotifications,
  CLOSE_TASK_STATUS,
  CLOSE_TASK_PRIORITY,
  VARIANCE_ALERT_SEVERITY,
  TIEOUT_STATUS,
} from './close-management';
export type {
  CloseTaskStatus,
  CloseTaskPriority,
  VarianceAlertSeverity,
  TieoutStatus,
} from './close-management';