// Export base repository
export * from './base-repository';

// Export entity repositories
export * from './customer-repository';
export * from './organization-repository';
export * from './subsidiary-repository';
export * from './department-repository';
export * from './location-repository';
export * from './class-repository';
export * from './account-repository';
export * from './entity-repository';
export * from './user-repository';
export * from './auth-entity-repository';

// Export GL repositories
export * from './gl-transaction-repository';
export * from './gl-reporting-repository';
export * from './accounting-period-repository';

// Export items repositories
export * from './units-of-measure-repository';
export * from './item-categories-repository';
export * from './items-repository';
export * from './pricing-repository';
export * from './vendor-items-repository';
export * from './inventory-tracking-repository';
export * from './assemblies-kits-repository';
export * from './warehouse-repository';

// Export subscription repositories
export * from './subscription-repository';
export * from './subscription-item-repository';
export * from './subscription-version-repository';
export * from './billing-schedule-repository';
export * from './invoice-repository';
export * from './payment-repository';
export * from './change-request-repository';

// Export SSP analytics repository
export * from './ssp-analytics-repository';

// Export GL integration repository
export * from './gl-integration-repository';

// Export revenue forecasting repository
export * from './revenue-forecasting-repository';

// Export analytics repositories
export * from './churn-prediction-repository';
export * from './cohort-analysis-repository';
export * from './contract-modification-repository';
export * from './scenario-analysis-repository';

// Export event store repositories
export * from './event-store-repository';
export * from './event-projection-repository';

// Export RBAC repositories
export * from './permission-repository';
export * from './audit-log-repository';

// Export project repositories
export * from './project-repository';
export * from './project-type-repository';
export * from './project-cost-code-repository';
export * from './project-budget-repository';
// TODO: Create project-expense-repository
// export * from './project-expense-repository';
export * from './project-reporting-repository';
export * from './project-progress-snapshot-repository';

// Export time tracking repository
export * from './time-entry-repository';

// Export expense tracking repository
export * from './expense-entry-repository';

// Export SOV and Pay Application repositories
export * from './sov-repository';
export * from './pay-application-repository';

// Export Close Management repository
export * from './close-management-repository';

// Export WIP Reporting repository
export * from './wip-reporting-repository';

// Export Consolidation repository
export * from './consolidation-repository';

// Export Metrics repository
export * from './metrics-repository';

// Export Report Schedule repository
export * from './report-schedule-repository';

// Export Delivery Queue repository
export * from './delivery-queue-repository';

// Export Import Batch repository (data migration)
export * from './import-batch-repository';

// Export Onboarding repository
export * from './onboarding-repository';

// Export Project Task repository
export * from './project-task-repository';

// Export Accounting List repository
export * from './accounting-list-repository';

// Export Saved Report Configs repository
export * from './saved-report-configs-repository';

// Export Vendor Bill repositories
export * from './vendor-bill-repository';
export * from './vendor-bill-line-repository';

// Export Purchase Order repositories
export * from './purchase-order-repository';
export * from './purchase-order-line-repository';
export * from './purchase-order-receipt-repository';

// Export repository instances for dependency injection
import { DepartmentRepository } from './department-repository';
import { LocationRepository } from './location-repository';
import { ClassRepository } from './class-repository';
import { AccountRepository } from './account-repository';
import { EntityRepository } from './entity-repository';
import { GlTransactionRepository } from './gl-transaction-repository';
import { GlReportingRepository } from './gl-reporting-repository';
import { UnitsOfMeasureRepository } from './units-of-measure-repository';
import { ItemCategoriesRepository } from './item-categories-repository';
import { ItemsRepository } from './items-repository';
import { PricingRepository } from './pricing-repository';
import { VendorItemsRepository } from './vendor-items-repository';
import { InventoryTrackingRepository } from './inventory-tracking-repository';
import { AssembliesKitsRepository } from './assemblies-kits-repository';
import { WarehouseRepository } from './warehouse-repository';
import { SubscriptionRepository } from './subscription-repository';
import { SubscriptionItemRepository } from './subscription-item-repository';
import { SubscriptionVersionRepository } from './subscription-version-repository';
import { BillingScheduleRepository } from './billing-schedule-repository';
import { InvoiceRepository } from './invoice-repository';
import { PaymentRepository } from './payment-repository';
import { ChangeRequestRepository } from './change-request-repository';
import { SSPAnalyticsRepository } from './ssp-analytics-repository';
import { GLIntegrationRepository } from './gl-integration-repository';
import { RevenueForecastingRepository } from './revenue-forecasting-repository';
import { ChurnPredictionRepository } from './churn-prediction-repository';
import { CohortAnalysisRepository } from './cohort-analysis-repository';
import { ContractModificationRepository } from './contract-modification-repository';
import { ScenarioAnalysisRepository } from './scenario-analysis-repository';
import { AccountingPeriodRepository } from './accounting-period-repository';
import { PermissionRepository } from './permission-repository';
import { AuditLogRepository } from './audit-log-repository';
import { EventProjectionRepository } from './event-projection-repository';
import { ProjectRepository } from './project-repository';
import { ProjectTypeRepository } from './project-type-repository';
import { ProjectCostCodeRepository } from './project-cost-code-repository';
import { ProjectBudgetRepository } from './project-budget-repository';
import { TimeEntryRepository } from './time-entry-repository';
import { ExpenseEntryRepository } from './expense-entry-repository';
import { SovRepository } from './sov-repository';
import { PayApplicationRepository } from './pay-application-repository';
import { CloseManagementRepository } from './close-management-repository';
import { WipReportingRepository } from './wip-reporting-repository';
import { ConsolidationRepository } from './consolidation-repository';
import { MetricsRepository } from './metrics-repository';
import { ReportScheduleRepository } from './report-schedule-repository';
import { DeliveryQueueRepository } from './delivery-queue-repository';
import { ImportBatchRepository } from './import-batch-repository';
import { ProjectTaskRepository } from './project-task-repository';
import { AuthEntityRepository } from './auth-entity-repository';
import { AccountingListRepository } from './accounting-list-repository';
import { SavedReportConfigsRepository } from './saved-report-configs-repository';
import { VendorBillRepository } from './vendor-bill-repository';
import { VendorBillLineRepository } from './vendor-bill-line-repository';
import { PurchaseOrderRepository } from './purchase-order-repository';
import { PurchaseOrderLineRepository } from './purchase-order-line-repository';
import { PurchaseOrderReceiptRepository } from './purchase-order-receipt-repository';

// Create singleton instances - initialized on first use
// Explicit type annotations to avoid TS7056 "inferred type exceeds max length"
export const departmentRepository: DepartmentRepository = new DepartmentRepository();
export const locationRepository: LocationRepository = new LocationRepository();
export const classRepository: ClassRepository = new ClassRepository();
export const accountRepository: AccountRepository = new AccountRepository();
export const entityRepository: EntityRepository = new EntityRepository();
export const glTransactionRepository: GlTransactionRepository = new GlTransactionRepository();
export const glReportingRepository: GlReportingRepository = new GlReportingRepository();
export const unitsOfMeasureRepository: UnitsOfMeasureRepository = new UnitsOfMeasureRepository();
export const itemCategoriesRepository: ItemCategoriesRepository = new ItemCategoriesRepository();
export const itemsRepository: ItemsRepository = new ItemsRepository();
export const pricingRepository: PricingRepository = new PricingRepository();
export const vendorItemsRepository: VendorItemsRepository = new VendorItemsRepository();
export const inventoryTrackingRepository: InventoryTrackingRepository = new InventoryTrackingRepository();
export const assembliesKitsRepository: AssembliesKitsRepository = new AssembliesKitsRepository();
export const warehouseRepository: WarehouseRepository = new WarehouseRepository();
export const subscriptionRepository: SubscriptionRepository = new SubscriptionRepository();
export const subscriptionItemRepository: SubscriptionItemRepository = new SubscriptionItemRepository();
export const subscriptionVersionRepository: SubscriptionVersionRepository = new SubscriptionVersionRepository();
export const billingScheduleRepository: BillingScheduleRepository = new BillingScheduleRepository();
export const invoiceRepository: InvoiceRepository = new InvoiceRepository();
export const paymentRepository: PaymentRepository = new PaymentRepository();
export const changeRequestRepository: ChangeRequestRepository = new ChangeRequestRepository();
export const sspAnalyticsRepository: SSPAnalyticsRepository = new SSPAnalyticsRepository();
export const glIntegrationRepository: GLIntegrationRepository = new GLIntegrationRepository();
export const revenueForecastingRepository: RevenueForecastingRepository = new RevenueForecastingRepository();
export const churnPredictionRepository: ChurnPredictionRepository = new ChurnPredictionRepository();
export const cohortAnalysisRepository: CohortAnalysisRepository = new CohortAnalysisRepository();
export const contractModificationRepository: ContractModificationRepository = new ContractModificationRepository();
export const scenarioAnalysisRepository: ScenarioAnalysisRepository = new ScenarioAnalysisRepository();
export const accountingPeriodRepository: AccountingPeriodRepository = new AccountingPeriodRepository();
export const permissionRepository: PermissionRepository = new PermissionRepository();
export const auditLogRepository: AuditLogRepository = new AuditLogRepository();
export const eventProjectionRepository: EventProjectionRepository = new EventProjectionRepository();
export const projectRepository: ProjectRepository = new ProjectRepository();
export const projectTypeRepository: ProjectTypeRepository = new ProjectTypeRepository();
export const projectCostCodeRepository: ProjectCostCodeRepository = new ProjectCostCodeRepository();
export const projectBudgetRepository: ProjectBudgetRepository = new ProjectBudgetRepository();
export const timeEntryRepository: TimeEntryRepository = new TimeEntryRepository();
export const expenseEntryRepository: ExpenseEntryRepository = new ExpenseEntryRepository();
export const sovRepository: SovRepository = new SovRepository();
export const payApplicationRepository: PayApplicationRepository = new PayApplicationRepository();
export const closeManagementRepository: CloseManagementRepository = new CloseManagementRepository();
export const wipReportingRepository: WipReportingRepository = new WipReportingRepository();
export const consolidationRepository: ConsolidationRepository = new ConsolidationRepository();
export const metricsRepository: MetricsRepository = new MetricsRepository();
export const reportScheduleRepository: ReportScheduleRepository = new ReportScheduleRepository();
export const deliveryQueueRepository: DeliveryQueueRepository = new DeliveryQueueRepository();
export const importBatchRepository: ImportBatchRepository = new ImportBatchRepository();
export const projectTaskRepository: ProjectTaskRepository = new ProjectTaskRepository();
export const authEntityRepository: AuthEntityRepository = new AuthEntityRepository();
export const accountingListRepository: AccountingListRepository = new AccountingListRepository();
export const savedReportConfigsRepository: SavedReportConfigsRepository = new SavedReportConfigsRepository();
export const vendorBillRepository: VendorBillRepository = new VendorBillRepository();
export const vendorBillLineRepository: VendorBillLineRepository = new VendorBillLineRepository();
export const purchaseOrderRepository: PurchaseOrderRepository = new PurchaseOrderRepository();
export const purchaseOrderLineRepository: PurchaseOrderLineRepository = new PurchaseOrderLineRepository();
export const purchaseOrderReceiptRepository: PurchaseOrderReceiptRepository = new PurchaseOrderReceiptRepository();
