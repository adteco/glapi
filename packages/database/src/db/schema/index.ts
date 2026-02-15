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
import * as projectTypes from './project-types';
import * as projectProgress from './project-progress';
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
import * as subscriptionVersions from './subscription-versions';
import * as billingSchedulesSchemas from './billing-schedules';
import * as invoices from './invoices';
import * as invoiceLineItemsSchemas from './invoice-line-items';
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

// Approval workflow schemas
import * as approvalWorkflowSchemas from './approval-workflow';

// Audit logging schemas
import * as auditLogSchemas from './audit-logs';

// Time tracking schemas
import * as timeEntriesSchemas from './time-entries';

// Expense tracking schemas
import * as expenseEntriesSchemas from './expense-entries';

// Schedule of Values and Pay Applications schemas
import * as scheduleOfValuesSchemas from './schedule-of-values';
import * as payApplicationsSchemas from './pay-applications';

// Sales Orders (Order-to-Cash)
import * as salesOrdersSchemas from './sales-orders';

// Customer Payments (Cash Application)
import * as customerPaymentsSchemas from './customer-payments';

// Close Management schemas
import * as closeManagementSchemas from './close-management';

// Procure-to-Pay schemas
import * as purchaseOrdersSchemas from './purchase-orders';
import * as vendorBillsSchemas from './vendor-bills';

// Consolidation schemas (multi-book accounting)
import * as consolidationSchemas from './consolidation';

// Metrics and dashboards schemas
import * as metricsSchemas from './metrics';

// Report scheduling schemas
import * as reportSchedulesSchemas from './report-schedules';

// Delivery queue schemas
import * as deliveryQueueSchemas from './delivery-queue';

// Import staging schemas (data migration)
import * as importStagingSchemas from './import-staging';

// Onboarding schemas
import * as onboardingSchemas from './onboarding';

// Project Tasks schemas
import * as projectTasksSchemas from './project-tasks';

// Accounting Lists schemas
import * as accountingListsSchemas from './accounting-lists';

// Workflows schemas
import * as workflowsSchemas from './workflows';

// Task Templates schemas
import * as taskTemplatesSchemas from './task-templates';

// Task Field Definitions schemas
import * as taskFieldDefinitionsSchemas from './task-field-definitions';

// Entity Tasks schemas (polymorphic tasks)
import * as entityTasksSchemas from './entity-tasks';

// Saved Report Configs schemas
import * as savedReportConfigsSchemas from './saved-report-configs';

// Communications system schemas
import * as emailTemplatesSchemas from './email-templates';
import * as communicationEventsSchemas from './communication-events';
import * as communicationWorkflowsSchemas from './communication-workflows';
import * as emailTrackingSchemas from './email-tracking';

// Entity Contacts junction table (many-to-many contacts)
import * as entityContactsSchemas from './entity-contacts';

// Pending Documents schemas (Magic Inbox integration)
import * as pendingDocumentsSchemas from './pending-documents';

// Magic Inbox Configuration schemas
import * as magicInboxConfigSchemas from './magic-inbox-config';

// Temporarily comment out GL tables to test
import * as testGl from './test-gl';

// Note: The schema object combines all table definitions for drizzle.
// TypeScript declaration serialization is handled via explicit type exports.
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
  ...projectTypes,
  ...projectProgress,
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
  ...subscriptionVersions,
  ...billingSchedulesSchemas,
  ...invoices,
  ...invoiceLineItemsSchemas,
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
  // Approval workflow schemas
  ...approvalWorkflowSchemas,
  // Audit logging schemas
  ...auditLogSchemas,
  // Time tracking schemas
  ...timeEntriesSchemas,
  // Expense tracking schemas
  ...expenseEntriesSchemas,
  // Schedule of Values and Pay Applications schemas
  ...scheduleOfValuesSchemas,
  ...payApplicationsSchemas,
  // Sales Orders (Order-to-Cash)
  ...salesOrdersSchemas,
  // Customer Payments (Cash Application)
  ...customerPaymentsSchemas,
  // Close Management schemas
  ...closeManagementSchemas,
  // Procure-to-Pay schemas
  ...purchaseOrdersSchemas,
  ...vendorBillsSchemas,
  // Consolidation schemas (multi-book accounting)
  ...consolidationSchemas,
  // Metrics and dashboards schemas
  ...metricsSchemas,
  // Report scheduling schemas
  ...reportSchedulesSchemas,
  // Delivery queue schemas
  ...deliveryQueueSchemas,
  // Import staging schemas (data migration)
  ...importStagingSchemas,
  // Onboarding schemas
  ...onboardingSchemas,
  // Project Tasks schemas
  ...projectTasksSchemas,
  // Accounting Lists schemas
  ...accountingListsSchemas,
  // Workflows schemas
  ...workflowsSchemas,
  // Task Templates schemas
  ...taskTemplatesSchemas,
  // Task Field Definitions schemas
  ...taskFieldDefinitionsSchemas,
  // Entity Tasks schemas (polymorphic tasks)
  ...entityTasksSchemas,
  // Saved Report Configs schemas
  ...savedReportConfigsSchemas,
  // Communications system schemas
  ...emailTemplatesSchemas,
  ...communicationEventsSchemas,
  ...communicationWorkflowsSchemas,
  ...emailTrackingSchemas,
  // Entity Contacts junction table (many-to-many contacts)
  ...entityContactsSchemas,
  // Pending Documents schemas (Magic Inbox integration)
  ...pendingDocumentsSchemas,
  // Magic Inbox Configuration schemas
  ...magicInboxConfigSchemas,
};

// Re-export specific types from new schemas
export type { Subscription, NewSubscription, UpdateSubscription } from './subscriptions';
export type { SubscriptionItem, NewSubscriptionItem, UpdateSubscriptionItem } from './subscription-items';
export type { SubscriptionVersion, NewSubscriptionVersion, UpdateSubscriptionVersion, SubscriptionSnapshot, SubscriptionItemSnapshot, SubscriptionChangedField } from './subscription-versions';
export { subscriptionVersions, subscriptionVersionTypeEnum, subscriptionVersionSourceEnum } from './subscription-versions';
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
export { invoiceLineItems } from './invoice-line-items';
export type { InvoiceLineItem, NewInvoiceLineItem, UpdateInvoiceLineItem } from './invoice-line-items';
export { payments } from './payments';

// Re-export contract modification schemas
export {
  contractModifications,
  modificationMethodEnum,
  modificationTypeEnum,
  modificationStatusEnum,
  ModificationMethod,
  ModificationType,
  ModificationStatus
} from './contract-modifications';
export type {
  ContractModification,
  NewContractModification,
  UpdateContractModification,
  ModificationMethodValue,
  ModificationTypeValue,
  ModificationStatusValue
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

// Re-export approval workflow schemas
export {
  approvalInstances,
  approvalActions,
  approvalStatusEnum,
  workflowApprovalActionTypeEnum,
} from './approval-workflow';
export type {
  ApprovalInstance,
  NewApprovalInstance,
  WorkflowApprovalAction,
  NewApprovalAction,
} from './approval-workflow';

// Re-export unified audit log schemas
export {
  unifiedAuditLog,
  auditEvidencePackages,
  changeRequests,
  auditActionTypeEnum,
  auditSeverityEnum,
  changeRequestStatusEnum,
  AuditActionType,
  AuditSeverity,
} from './audit-logs';
export type {
  UnifiedAuditLogRecord,
  NewUnifiedAuditLogRecord,
  AuditEvidencePackageRecord,
  NewAuditEvidencePackageRecord,
  ChangeRequestRecord,
  NewChangeRequestRecord,
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

// Re-export expense tracking schemas
export {
  expenseEntries,
  expenseAttachments,
  expenseEntryApprovals,
  expenseReports,
  expenseReportItems,
  expensePolicies,
  expenseEntryStatusEnum,
  expenseCategoryEnum,
  paymentMethodEnum,
} from './expense-entries';
export type {
  ExpenseEntry,
  NewExpenseEntry,
  UpdateExpenseEntry,
  ExpenseAttachment,
  NewExpenseAttachment,
  ExpenseEntryApproval,
  NewExpenseEntryApproval,
  ExpenseReport,
  NewExpenseReport,
  UpdateExpenseReport,
  ExpenseReportItem,
  NewExpenseReportItem,
  ExpensePolicy,
  NewExpensePolicy,
  UpdateExpensePolicy,
  ExpenseEntryStatus,
  ExpenseCategory,
  PaymentMethod,
} from './expense-entries';

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
  salesOrderApprovalActionEnum,
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

// Re-export Customer Payments schemas (Cash Application)
export {
  customerPayments,
  customerPaymentApplications,
  bankDeposits,
  bankReconciliationExceptions,
  customerCreditMemos,
  customerPaymentStatusEnum,
  paymentMethodTypeEnum,
  bankDepositStatusEnum,
  reconciliationStatusEnum,
  applicationMethodEnum,
  CustomerPaymentStatus,
  BankDepositStatus,
  ReconciliationStatus,
  ApplicationMethod,
} from './customer-payments';
export type {
  CustomerPayment,
  NewCustomerPayment,
  UpdateCustomerPayment,
  CustomerPaymentApplication,
  NewCustomerPaymentApplication,
  BankDeposit,
  NewBankDeposit,
  UpdateBankDeposit,
  BankReconciliationException,
  NewBankReconciliationException,
  CustomerCreditMemo,
  NewCustomerCreditMemo,
  CustomerPaymentStatusValue,
  BankDepositStatusValue,
  ReconciliationStatusValue,
  ApplicationMethodValue,
} from './customer-payments';

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

// Re-export entities and accounts tables for direct access
export { entities } from './entities';
export { accounts } from './accounts';
export { locations } from './locations';
export { departments } from './departments';
export { classes } from './classes';
export { subsidiaries } from './subsidiaries';
export { projects } from './projects';
export { projectTypes } from './project-types';
export type { ProjectType, NewProjectType } from './project-types';
export { organizations } from './organizations';

// Re-export Purchase Order schemas (Procure-to-Pay)
export {
  purchaseOrders,
  purchaseOrderLines,
  purchaseOrderReceipts,
  purchaseOrderReceiptLines,
  purchaseOrderApprovalHistory,
  purchaseOrderStatusEnum,
  receiptStatusEnum,
  poApprovalActionTypeEnum,
  PurchaseOrderStatus,
  ReceiptStatus,
  POApprovalActionType,
  VALID_PURCHASE_ORDER_TRANSITIONS,
} from './purchase-orders';
export type {
  PurchaseOrder,
  NewPurchaseOrder,
  UpdatePurchaseOrder,
  PurchaseOrderLine,
  NewPurchaseOrderLine,
  UpdatePurchaseOrderLine,
  PurchaseOrderReceipt,
  NewPurchaseOrderReceipt,
  UpdatePurchaseOrderReceipt,
  PurchaseOrderReceiptLine,
  NewPurchaseOrderReceiptLine,
  PurchaseOrderApprovalHistoryRecord,
  NewPurchaseOrderApprovalHistoryRecord,
  PurchaseOrderStatusValue,
  ReceiptStatusValue,
  POApprovalActionTypeValue,
} from './purchase-orders';

// Re-export Vendor Bill schemas (Procure-to-Pay)
export {
  vendorBills,
  vendorBillLines,
  billPayments,
  billPaymentApplications,
  vendorCreditMemos,
  vendorBillApprovalHistory,
  vendorBillStatusEnum,
  billPaymentStatusEnum,
  vendorPaymentMethodEnum,
  threeWayMatchStatusEnum,
  billApprovalActionTypeEnum,
  VendorBillStatus,
  BillPaymentStatus,
  VendorPaymentMethod,
  ThreeWayMatchStatus,
  BillApprovalActionType,
  VALID_VENDOR_BILL_TRANSITIONS,
} from './vendor-bills';
export type {
  VendorBill,
  NewVendorBill,
  UpdateVendorBill,
  VendorBillLine,
  NewVendorBillLine,
  UpdateVendorBillLine,
  BillPayment,
  NewBillPayment,
  UpdateBillPayment,
  BillPaymentApplication,
  NewBillPaymentApplication,
  VendorCreditMemo,
  NewVendorCreditMemo,
  VendorBillApprovalHistoryRecord,
  NewVendorBillApprovalHistoryRecord,
  VendorBillStatusValue,
  BillPaymentStatusValue,
  VendorPaymentMethodValue,
  ThreeWayMatchStatusValue,
  BillApprovalActionTypeValue,
} from './vendor-bills';

// Re-export Billing Schedule schemas
export {
  billingSchedules,
  billingScheduleLines,
  billingScheduleStatusEnum,
  billingScheduleLineStatusEnum,
} from './billing-schedules';
export type {
  BillingSchedule,
  NewBillingSchedule,
  UpdateBillingSchedule,
  BillingScheduleLine,
  NewBillingScheduleLine,
  UpdateBillingScheduleLine,
  BillingScheduleWithLines,
  BillingScheduleStatus,
  BillingScheduleLineStatus,
} from './billing-schedules';

// Re-export Consolidation schemas (multi-book accounting)
export {
  consolidationGroups,
  consolidationGroupMembers,
  eliminationRules,
  fxTranslationRules,
  consolidationExchangeRates,
  consolidationRuns,
  consolidationAdjustments,
  intercompanyAccountMappings,
  consolidationMethodEnum,
  eliminationTypeEnum,
  translationMethodEnum,
  consolidationRunStatusEnum,
} from './consolidation';

// Re-export Metrics and dashboard schemas
export {
  customMetrics,
  savedViews,
  metricSnapshots,
  dashboardLayouts,
} from './metrics';

// Re-export Report scheduling schemas
export {
  reportSchedules,
  reportJobExecutions,
  reportScheduleStatusEnum,
  reportScheduleFrequencyEnum,
  reportTypeEnum,
  jobExecutionStatusEnum,
  reportOutputFormatEnum,
} from './report-schedules';
export type {
  ReportSchedule,
  NewReportSchedule,
  UpdateReportSchedule,
  ReportJobExecution,
  NewReportJobExecution,
  UpdateReportJobExecution,
  ReportScheduleWithExecutions,
  ReportScheduleStatus,
  ReportScheduleFrequency,
  ReportType,
  JobExecutionStatus,
  ReportOutputFormat,
  ReportFilters,
  DeliveryConfig,
} from './report-schedules';

// Re-export Delivery queue schemas
export {
  deliveryQueue,
  deliveryAttempts,
  deliveryStatusEnum,
  deliveryTypeEnum,
} from './delivery-queue';
export type {
  DeliveryQueueItem,
  NewDeliveryQueueItem,
  UpdateDeliveryQueueItem,
  DeliveryAttempt,
  NewDeliveryAttempt,
  DeliveryQueueConfig,
  DeliveryResponse,
  DeliveryStatus,
  DeliveryType,
} from './delivery-queue';

// Re-export Import Staging schemas (data migration)
export {
  importBatches,
  importRecords,
  importFieldMappings,
  importTemplates,
  importAuditLogs,
  importBatchStatusEnum,
  importRecordStatusEnum,
  importDataTypeEnum,
  importSourceSystemEnum,
} from './import-staging';
export type {
  ImportBatchOptions,
  ImportTemplateOptions,
  FieldMapping,
  FieldTransformation,
  ValidationRule,
  ValidationError,
  ValidationWarning,
  ImportErrorSummary,
} from './import-staging';

// Re-export Onboarding schemas
export {
  organizationOnboarding,
  onboardingSteps,
  onboardingChecklistItems,
  onboardingEvents,
  onboardingStepStatusEnum,
  onboardingStatusEnum,
  DEFAULT_ONBOARDING_STEPS,
} from './onboarding';
export type {
  OrganizationOnboarding,
  NewOrganizationOnboarding,
  OnboardingStep,
  NewOnboardingStep,
  OnboardingChecklistItem,
  NewOnboardingChecklistItem,
  OnboardingEvent,
  NewOnboardingEvent,
  OnboardingStepStatus,
  OnboardingStatus,
} from './onboarding';

// Re-export Project Tasks schemas
export {
  projectMilestones,
  projectTaskTemplates,
  projectTasks,
  projectTemplates,
  projectTemplateTasks,
  projectTaskStatusEnum,
  projectTaskPriorityEnum,
  projectMilestoneStatusEnum,
  taskBillingTypeEnum,
  PROJECT_TASK_STATUS,
  PROJECT_TASK_PRIORITY,
  PROJECT_MILESTONE_STATUS,
  TASK_BILLING_TYPE,
} from './project-tasks';
export type {
  ProjectMilestone,
  NewProjectMilestone,
  UpdateProjectMilestone,
  ProjectTaskTemplate,
  NewProjectTaskTemplate,
  UpdateProjectTaskTemplate,
  ProjectTask,
  NewProjectTask,
  UpdateProjectTask,
  ProjectTemplate,
  NewProjectTemplate,
  UpdateProjectTemplate,
  ProjectTemplateTask,
  NewProjectTemplateTask,
  ProjectTaskStatus,
  ProjectTaskPriority,
  ProjectMilestoneStatus,
  TaskBillingType,
} from './project-tasks';

// Re-export Accounting Lists schemas
export {
  accountingLists,
  paymentTermsDetails,
  paymentMethodsDetails,
  chargeTypesDetails,
  customerAccountingLists,
  accountingListTypeEnum,
  dueDateTypeEnum,
  accountingPaymentMethodTypeEnum,
  chargeCategoryEnum,
} from './accounting-lists';
export type {
  AccountingList,
  NewAccountingList,
  PaymentTermsDetail,
  NewPaymentTermsDetail,
  PaymentMethodsDetail,
  NewPaymentMethodsDetail,
  ChargeTypesDetail,
  NewChargeTypesDetail,
  CustomerAccountingList,
  NewCustomerAccountingList,
  AccountingListType,
  DueDateType,
  PaymentMethodType,
  ChargeCategory,
  PaymentTermsWithDetails,
  PaymentMethodWithDetails,
  ChargeTypeWithDetails,
} from './accounting-lists';

// Re-export Workflows schemas
export {
  workflows,
  workflowGroups,
  workflowComponents,
  workflowComponentTypeEnum,
} from './workflows';
export type {
  Workflow,
  NewWorkflow,
  UpdateWorkflow,
  WorkflowGroup,
  NewWorkflowGroup,
  UpdateWorkflowGroup,
  WorkflowComponent,
  NewWorkflowComponent,
  UpdateWorkflowComponent,
  WorkflowComponentType,
  WorkflowWithGroups,
  WorkflowWithComponents,
  WorkflowWithGroupsAndComponents,
} from './workflows';

// Re-export Task Templates schemas
export {
  taskTemplates,
} from './task-templates';
export type {
  TaskTemplate,
  NewTaskTemplate,
  UpdateTaskTemplate,
  TaskTemplateData,
  TaskTemplateItem,
  TaskTemplatePriority,
} from './task-templates';

// Re-export Task Field Definitions schemas
export {
  taskFieldDefinitions,
  taskFieldTypeEnum,
  TASK_FIELD_TYPE,
} from './task-field-definitions';
export type {
  TaskFieldDefinition,
  NewTaskFieldDefinition,
  UpdateTaskFieldDefinition,
  TaskFieldType,
  SelectOption,
  SelectFieldOptions,
  NumberFieldOptions,
  TextFieldOptions,
  FieldOptions,
} from './task-field-definitions';

// Re-export Entity Tasks schemas (polymorphic tasks)
export {
  entityTasks,
  entityTaskEntityTypeEnum,
  entityTaskStatusEnum,
  entityTaskPriorityEnum,
  ENTITY_TASK_ENTITY_TYPE,
  ENTITY_TASK_STATUS,
  ENTITY_TASK_PRIORITY,
} from './entity-tasks';
export type {
  EntityTask,
  NewEntityTask,
  UpdateEntityTask,
  EntityTaskEntityType,
  EntityTaskStatus,
  EntityTaskPriority,
} from './entity-tasks';

// Re-export Saved Report Configs schemas
export {
  savedReportConfigs,
  REPORT_TYPES,
} from './saved-report-configs';
export type {
  SavedReportConfig,
  NewSavedReportConfig,
  SavedReportType,
  SavedReportConfigJson,
} from './saved-report-configs';

// Re-export Email Templates schemas
export {
  emailTemplates,
  emailTemplateStatusEnum,
  emailTemplateCategoryEnum,
  EMAIL_TEMPLATE_STATUS,
  EMAIL_TEMPLATE_CATEGORY,
} from './email-templates';
export type {
  EmailTemplate,
  NewEmailTemplate,
  UpdateEmailTemplate,
  EmailTemplateStatus,
  EmailTemplateCategory,
  TemplateVariable,
} from './email-templates';

// Re-export Communication Events schemas
export {
  communicationEvents,
  communicationEventTypeEnum,
  communicationStatusEnum,
  COMMUNICATION_STATUS,
  COMMUNICATION_EVENT_TYPE,
  COMMUNICATION_ENTITY_TYPES,
} from './communication-events';
export type {
  CommunicationEvent,
  NewCommunicationEvent,
  UpdateCommunicationEvent,
  CommunicationEventType,
  CommunicationStatus,
  CommunicationEntityType,
} from './communication-events';

// Re-export Communication Workflows schemas
export {
  communicationWorkflows,
  communicationWorkflowSteps,
  communicationWorkflowExecutions,
  communicationWorkflowStepHistory,
  commWorkflowTriggerTypeEnum,
  commWorkflowStepTypeEnum,
  commWorkflowExecutionStatusEnum,
  WORKFLOW_TRIGGER_TYPE,
  WORKFLOW_STEP_TYPE,
  WORKFLOW_EXECUTION_STATUS,
} from './communication-workflows';
export type {
  CommunicationWorkflow,
  NewCommunicationWorkflow,
  UpdateCommunicationWorkflow,
  CommunicationWorkflowStep,
  NewCommunicationWorkflowStep,
  UpdateCommunicationWorkflowStep,
  CommunicationWorkflowExecution,
  NewCommunicationWorkflowExecution,
  UpdateCommunicationWorkflowExecution,
  CommunicationWorkflowStepHistoryRecord,
  NewCommunicationWorkflowStepHistoryRecord,
  WorkflowTriggerType,
  WorkflowStepType,
  WorkflowExecutionStatus,
  TriggerConfig,
  FilterConditions,
  FilterRule,
  StepConfig,
  BranchConfig,
  Branch,
  ExecutionContext,
} from './communication-workflows';

// Re-export Email Tracking schemas
export {
  emailTrackingEvents,
  emailUnsubscribes,
  emailSuppressionList,
  emailTrackingEventTypeEnum,
  emailBounceTypeEnum,
  emailUnsubscribeReasonEnum,
  EMAIL_TRACKING_EVENT_TYPE,
  EMAIL_BOUNCE_TYPE,
  EMAIL_UNSUBSCRIBE_REASON,
  generateEmailHash,
} from './email-tracking';
export type {
  EmailTrackingEvent,
  NewEmailTrackingEvent,
  EmailUnsubscribe,
  NewEmailUnsubscribe,
  UpdateEmailUnsubscribe,
  EmailSuppressionRecord,
  NewEmailSuppressionRecord,
  EmailTrackingEventType,
  EmailBounceType,
  EmailUnsubscribeReason,
  BouncedRecipient,
} from './email-tracking';

// Re-export Entity Contacts schemas
export {
  entityContacts,
  CONTACT_ROLES,
} from './entity-contacts';
export type {
  EntityContact,
  NewEntityContact,
  UpdateEntityContact,
  ContactRole,
} from './entity-contacts';

// Re-export Pending Documents schemas (Magic Inbox integration)
export {
  pendingDocuments,
  pendingDocumentReviewHistory,
  pendingDocumentSourceEnum,
  pendingDocumentTypeEnum,
  pendingDocumentStatusEnum,
  pendingDocumentPriorityEnum,
  conversionTargetTypeEnum,
  PendingDocumentSource,
  PendingDocumentType,
  PendingDocumentStatus,
  PendingDocumentPriority,
  ConversionTargetType,
  VALID_PENDING_DOCUMENT_TRANSITIONS,
} from './pending-documents';
export type {
  PendingDocument,
  NewPendingDocument,
  UpdatePendingDocument,
  PendingDocumentReviewHistoryRecord,
  NewPendingDocumentReviewHistoryRecord,
  PendingDocumentWithRelations,
  PendingDocumentSourceValue,
  PendingDocumentTypeValue,
  PendingDocumentStatusValue,
  PendingDocumentPriorityValue,
  ConversionTargetTypeValue,
  ExtractedEntities,
  ExtractedInvoiceData,
  ExtractedData,
  PendingDocumentMetadata,
} from './pending-documents';

// Re-export Magic Inbox Configuration schemas
export {
  magicInboxEmailRegistry,
  magicInboxUsage,
  magicInboxTestEmails,
  magicInboxEmailTypeEnum,
  magicInboxVerificationStatusEnum,
  MagicInboxEmailType,
  MagicInboxVerificationStatus,
} from './magic-inbox-config';
export type {
  MagicInboxEmailRegistryRecord,
  NewMagicInboxEmailRegistryRecord,
  UpdateMagicInboxEmailRegistryRecord,
  MagicInboxUsageRecord,
  NewMagicInboxUsageRecord,
  UpdateMagicInboxUsageRecord,
  MagicInboxTestEmailRecord,
  NewMagicInboxTestEmailRecord,
  UpdateMagicInboxTestEmailRecord,
  MagicInboxEmailTypeValue,
  MagicInboxVerificationStatusValue,
  DNSRecord,
  MagicInboxSettings,
  MagicInboxUsageSummary,
  MagicInboxBillingRecord,
  MagicInboxTestResult,
} from './magic-inbox-config';
