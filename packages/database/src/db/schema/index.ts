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
import * as projectExpenses from './project-expenses';
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

// Customer Payments (Cash Application)
import * as customerPaymentsSchemas from './customer-payments';

// Close Management schemas
import * as closeManagementSchemas from './close-management';

// Procure-to-Pay schemas (legacy - to be deprecated)
import * as purchaseOrdersSchemas from './purchase-orders';
import * as vendorBillsSchemas from './vendor-bills';

// ========================================
// Hybrid Transaction Model (NEW)
// ========================================
import * as transactionCoreSchemas from './transaction-core';
import * as purchaseOrderExtSchemas from './purchase-order-ext';
import * as poReceiptExtSchemas from './po-receipt-ext';
import * as vendorBillExtSchemas from './vendor-bill-ext';
import * as billPaymentExtSchemas from './bill-payment-ext';
import * as salesOrderExtSchemas from './sales-order-ext';
import * as invoiceExtSchemas from './invoice-ext';
import * as customerPaymentExtSchemas from './customer-payment-ext';
import * as transactionSupportingSchemas from './transaction-supporting';

// Item Costing Configuration
import * as itemCostingConfigSchemas from './item-costing-config';

// Inventory Adjustments and Transfers
import * as inventoryAdjustmentsSchemas from './inventory-adjustments';

// Approval Workflow and Segregation of Duties
import * as approvalWorkflowSchemas from './approval-workflow';

// Workflow Automation Engine
import * as workflowAutomationSchemas from './workflow-automation';

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
  ...projectExpenses,
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
  // Customer Payments (Cash Application)
  ...customerPaymentsSchemas,
  // Close Management schemas
  ...closeManagementSchemas,
  // Procure-to-Pay schemas (legacy)
  ...purchaseOrdersSchemas,
  ...vendorBillsSchemas,
  // ========================================
  // Hybrid Transaction Model (NEW)
  // ========================================
  ...transactionCoreSchemas,
  ...purchaseOrderExtSchemas,
  ...poReceiptExtSchemas,
  ...vendorBillExtSchemas,
  ...billPaymentExtSchemas,
  ...salesOrderExtSchemas,
  ...invoiceExtSchemas,
  ...customerPaymentExtSchemas,
  ...transactionSupportingSchemas,
  // Item Costing Configuration
  ...itemCostingConfigSchemas,
  // Inventory Adjustments and Transfers
  ...inventoryAdjustmentsSchemas,
  // Approval Workflow and Segregation of Duties
  ...approvalWorkflowSchemas,
  // Workflow Automation Engine
  ...workflowAutomationSchemas,
};

// Re-export specific types from new schemas
export type { Subscription, NewSubscription, UpdateSubscription } from './subscriptions';
export type { SubscriptionItem, NewSubscriptionItem, UpdateSubscriptionItem } from './subscription-items';
export type {
  SubscriptionVersion,
  NewSubscriptionVersion,
  SubscriptionVersionTypeValue,
  SubscriptionVersionSourceValue,
} from './subscription-versions';
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
export {
  subscriptionVersions,
  subscriptionVersionTypeEnum as SubscriptionVersionType,
  subscriptionVersionSourceEnum as SubscriptionVersionSource,
} from './subscription-versions';
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
export { organizations } from './organizations';
export { entities } from './entities';
export { accounts } from './accounts';
export { locations } from './locations';
export { departments } from './departments';
export { classes } from './classes';
export { subsidiaries } from './subsidiaries';

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

// ============================================================================
// HYBRID TRANSACTION MODEL EXPORTS (NEW)
// ============================================================================

// Transaction Core - Enums and Status Constants
export {
  // Enums (renamed to avoid conflicts with legacy schemas)
  purchaseOrderStatusEnum as hybridPurchaseOrderStatusEnum,
  poReceiptStatusEnum as hybridPoReceiptStatusEnum,
  vendorBillStatusEnum as hybridVendorBillStatusEnum,
  billPaymentStatusEnum as hybridBillPaymentStatusEnum,
  salesOrderStatusEnum2 as hybridSalesOrderStatusEnum,
  invoiceStatusEnum2 as hybridInvoiceStatusEnum,
  customerPaymentStatusEnum2 as hybridCustomerPaymentStatusEnum,
  threeWayMatchStatusEnum2 as hybridThreeWayMatchStatusEnum,
  lineMatchStatusEnum as hybridLineMatchStatusEnum,
  transactionCategoryEnum,
  entityRoleEnum,
  // Status Constants (renamed to avoid conflicts)
  PurchaseOrderStatus as HybridPurchaseOrderStatus,
  POReceiptStatus as HybridPOReceiptStatus,
  VendorBillStatus as HybridVendorBillStatus,
  BillPaymentStatus as HybridBillPaymentStatus,
  SalesOrderStatus2 as HybridSalesOrderStatus,
  InvoiceStatus2 as HybridInvoiceStatus,
  CustomerPaymentStatus2 as HybridCustomerPaymentStatus,
  ThreeWayMatchStatus2 as HybridThreeWayMatchStatus,
  LineMatchStatus as HybridLineMatchStatus,
  TransactionCategory,
  EntityRole,
  TransactionTypeCode,
  // Core Tables
  transactionTypesRegistry,
  transactionHeaders,
  transactionLines,
} from './transaction-core';

export type {
  TransactionHeader,
  NewTransactionHeader,
  UpdateTransactionHeader,
  TransactionLine,
  NewTransactionLine,
  UpdateTransactionLine,
  TransactionTypeRecord,
  NewTransactionTypeRecord,
  PurchaseOrderStatusValue as HybridPurchaseOrderStatusValue,
  POReceiptStatusValue as HybridPOReceiptStatusValue,
  VendorBillStatusValue as HybridVendorBillStatusValue,
  BillPaymentStatusValue as HybridBillPaymentStatusValue,
  SalesOrderStatusValue2 as HybridSalesOrderStatusValue,
  InvoiceStatusValue2 as HybridInvoiceStatusValue,
  CustomerPaymentStatusValue2 as HybridCustomerPaymentStatusValue,
  ThreeWayMatchStatusValue2 as HybridThreeWayMatchStatusValue,
  LineMatchStatusValue as HybridLineMatchStatusValue,
  TransactionCategoryValue,
  EntityRoleValue,
  TransactionTypeCodeValue,
} from './transaction-core';

// Purchase Order Extension
export {
  purchaseOrderExt,
  purchaseOrderLineExt,
} from './purchase-order-ext';

export type {
  PurchaseOrderExtRecord,
  NewPurchaseOrderExtRecord,
  UpdatePurchaseOrderExtRecord,
  PurchaseOrderLineExtRecord,
  NewPurchaseOrderLineExtRecord,
  UpdatePurchaseOrderLineExtRecord,
} from './purchase-order-ext';

// PO Receipt Extension
export {
  poReceiptExt,
  poReceiptLineExt,
} from './po-receipt-ext';

export type {
  POReceiptExtRecord,
  NewPOReceiptExtRecord,
  UpdatePOReceiptExtRecord,
  POReceiptLineExtRecord,
  NewPOReceiptLineExtRecord,
  UpdatePOReceiptLineExtRecord,
} from './po-receipt-ext';

// Vendor Bill Extension
export {
  vendorBillExt,
  vendorBillLineExt,
} from './vendor-bill-ext';

export type {
  VendorBillExtRecord,
  NewVendorBillExtRecord,
  UpdateVendorBillExtRecord,
  VendorBillLineExtRecord,
  NewVendorBillLineExtRecord,
  UpdateVendorBillLineExtRecord,
} from './vendor-bill-ext';

// Bill Payment Extension
export {
  billPaymentExt,
  billPaymentApplications2,
} from './bill-payment-ext';

export type {
  BillPaymentExtRecord,
  NewBillPaymentExtRecord,
  UpdateBillPaymentExtRecord,
  BillPaymentApplication2,
  NewBillPaymentApplication2,
} from './bill-payment-ext';

// Sales Order Extension
export {
  salesOrderExt,
  salesOrderLineExt,
  salesOrderApprovalHistory2,
} from './sales-order-ext';

export type {
  SalesOrderExtRecord,
  NewSalesOrderExtRecord,
  UpdateSalesOrderExtRecord,
  SalesOrderLineExtRecord,
  NewSalesOrderLineExtRecord,
  UpdateSalesOrderLineExtRecord,
  SalesOrderApprovalHistoryRecord2,
  NewSalesOrderApprovalHistoryRecord2,
} from './sales-order-ext';

// Invoice Extension
export {
  invoiceExt,
  invoiceLineExt,
} from './invoice-ext';

export type {
  InvoiceExtRecord,
  NewInvoiceExtRecord,
  UpdateInvoiceExtRecord,
  InvoiceLineExtRecord,
  NewInvoiceLineExtRecord,
  UpdateInvoiceLineExtRecord,
} from './invoice-ext';

// Customer Payment Extension
export {
  customerPaymentExt,
  customerPaymentApplications2,
} from './customer-payment-ext';

export type {
  CustomerPaymentExtRecord,
  NewCustomerPaymentExtRecord,
  UpdateCustomerPaymentExtRecord,
  CustomerPaymentApplication2,
  NewCustomerPaymentApplication2,
} from './customer-payment-ext';

// Transaction Supporting Tables (Approval History, Credit Memos)
export {
  purchaseOrderApprovalHistory2,
  vendorBillApprovalHistory2,
  vendorCreditMemos2,
  customerCreditMemos2,
} from './transaction-supporting';

export type {
  PurchaseOrderApprovalHistoryRecord2,
  NewPurchaseOrderApprovalHistoryRecord2,
  VendorBillApprovalHistoryRecord2,
  NewVendorBillApprovalHistoryRecord2,
  VendorCreditMemo2,
  NewVendorCreditMemo2,
  CustomerCreditMemo2,
  NewCustomerCreditMemo2,
} from './transaction-supporting';

// ============================================================================
// ITEM COSTING CONFIGURATION EXPORTS
// ============================================================================

export {
  CostingMethodEnum,
  organizationCostingDefaults,
  subsidiaryCostingConfig,
  itemCostingMethods,
  itemCostLayers,
  itemCostHistory,
} from './item-costing-config';

export type {
  CostingMethodValue,
  OrganizationCostingDefaultsRecord,
  InsertOrganizationCostingDefaults,
  SubsidiaryCostingConfigRecord,
  InsertSubsidiaryCostingConfig,
  ItemCostingMethodRecord,
  InsertItemCostingMethod,
  ItemCostLayerRecord,
  InsertItemCostLayer,
  ItemCostHistoryRecord,
  InsertItemCostHistory,
} from './item-costing-config';

// ============================================================================
// INVENTORY ADJUSTMENTS AND TRANSFERS EXPORTS
// ============================================================================

export {
  adjustmentTypeEnum,
  adjustmentStatusEnum,
  transferTypeEnum,
  transferStatusEnum,
  inventoryAdjustments,
  inventoryAdjustmentLines,
  inventoryTransfers,
  inventoryTransferLines,
  inventoryApprovalHistory,
  adjustmentReasonCodes,
} from './inventory-adjustments';

export type {
  AdjustmentTypeValue,
  AdjustmentStatusValue,
  TransferTypeValue,
  TransferStatusValue,
  InventoryAdjustmentRecord,
  InsertInventoryAdjustment,
  InventoryAdjustmentLineRecord,
  InsertInventoryAdjustmentLine,
  InventoryTransferRecord,
  InsertInventoryTransfer,
  InventoryTransferLineRecord,
  InsertInventoryTransferLine,
  InventoryApprovalHistoryRecord,
  InsertInventoryApprovalHistory,
  AdjustmentReasonCodeRecord,
  InsertAdjustmentReasonCode,
} from './inventory-adjustments';

// ============================================================================
// APPROVAL WORKFLOW AND SEGREGATION OF DUTIES EXPORTS
// ============================================================================

export {
  // Enums
  approvalDocumentTypeEnum,
  approvalLevelEnum,
  approvalInstanceStatusEnum,
  workflowApprovalActionEnum,
  sodConflictTypeEnum,
  // Tables
  approvalPolicies,
  approvalSteps,
  approvalInstances,
  approvalActions,
  sodPolicies,
  sodRules,
  sodViolations,
  // Constants
  ApprovalDocumentTypes,
  ApprovalLevels,
  ApprovalInstanceStatuses,
  ApprovalActions as WorkflowApprovalActions,
  SodConflictTypes,
  SodEnforcementModes,
  SodSeverityLevels,
} from './approval-workflow';

export type {
  // Approval Policy types
  ApprovalPolicy,
  NewApprovalPolicy,
  UpdateApprovalPolicy,
  ApprovalStep,
  NewApprovalStep,
  UpdateApprovalStep,
  ApprovalInstance,
  NewApprovalInstance,
  UpdateApprovalInstance,
  WorkflowApprovalAction,
  NewWorkflowApprovalAction,
  // SoD types
  SodPolicy,
  NewSodPolicy,
  UpdateSodPolicy,
  SodRule,
  NewSodRule,
  UpdateSodRule,
  SodViolation,
  NewSodViolation,
  // Enum value types
  ApprovalDocumentType,
  ApprovalLevel,
  ApprovalInstanceStatus,
  WorkflowApprovalActionType,
  SodConflictType,
  // Helper types
  ApprovalConditionRule,
  ApprovalSkipCondition,
} from './approval-workflow';

// ============================================================================
// WORKFLOW AUTOMATION ENGINE EXPORTS
// ============================================================================

export {
  // Enums
  workflowTriggerTypeEnum,
  workflowActionTypeEnum,
  workflowDefinitionStatusEnum,
  workflowInstanceStatusEnum,
  workflowStepExecutionStatusEnum,
  workflowErrorStrategyEnum,
  notificationChannelEnum,
  // Tables
  workflowDefinitions,
  workflowSteps,
  workflowInstances,
  workflowStepExecutions,
  workflowWebhooks,
  workflowSchedules,
  workflowEventSubscriptions,
  // Relations
  workflowDefinitionsRelations,
  workflowStepsRelations,
  workflowInstancesRelations,
  workflowStepExecutionsRelations,
  workflowWebhooksRelations,
  workflowSchedulesRelations,
  workflowEventSubscriptionsRelations,
} from './workflow-automation';

export type {
  // Table types
  WorkflowDefinition,
  NewWorkflowDefinition,
  WorkflowStep,
  NewWorkflowStep,
  WorkflowInstance,
  NewWorkflowInstance,
  WorkflowStepExecution,
  NewWorkflowStepExecution,
  WorkflowWebhook,
  NewWorkflowWebhook,
  WorkflowSchedule,
  NewWorkflowSchedule,
  WorkflowEventSubscription,
  NewWorkflowEventSubscription,
  // Enum types
  WorkflowTriggerType,
  WorkflowActionType,
  WorkflowDefinitionStatus,
  WorkflowInstanceStatus,
  WorkflowStepExecutionStatus,
  WorkflowErrorStrategy,
  NotificationChannel,
  // Configuration types
  EventTriggerConfig,
  ScheduleTriggerConfig,
  WebhookTriggerConfig,
  ManualTriggerConfig,
  TriggerCondition,
  WebhookActionConfig,
  InternalActionConfig,
  NotificationActionConfig,
  ConditionActionConfig,
  DelayActionConfig,
  TransformActionConfig,
  ApprovalActionConfig,
  LoopActionConfig,
  ParallelActionConfig,
  SubWorkflowActionConfig,
  RetryConfig,
} from './workflow-automation';
