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
export * from './invoice-repository';
export * from './payment-repository';

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

// Export event store repository
export * from './event-store-repository';

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
import { InvoiceRepository } from './invoice-repository';
import { PaymentRepository } from './payment-repository';
import { SSPAnalyticsRepository } from './ssp-analytics-repository';
import { GLIntegrationRepository } from './gl-integration-repository';
import { RevenueForecastingRepository } from './revenue-forecasting-repository';
import { ChurnPredictionRepository } from './churn-prediction-repository';
import { CohortAnalysisRepository } from './cohort-analysis-repository';
import { ContractModificationRepository } from './contract-modification-repository';
import { ScenarioAnalysisRepository } from './scenario-analysis-repository';
import { AccountingPeriodRepository } from './accounting-period-repository';

// Create singleton instances - initialized on first use
export const departmentRepository = new DepartmentRepository();
export const locationRepository = new LocationRepository();
export const classRepository = new ClassRepository();
export const accountRepository = new AccountRepository();
export const entityRepository = new EntityRepository();
export const glTransactionRepository = new GlTransactionRepository();
export const glReportingRepository = new GlReportingRepository();
export const unitsOfMeasureRepository = new UnitsOfMeasureRepository();
export const itemCategoriesRepository = new ItemCategoriesRepository();
export const itemsRepository = new ItemsRepository();
export const pricingRepository = new PricingRepository();
export const vendorItemsRepository = new VendorItemsRepository();
export const inventoryTrackingRepository = new InventoryTrackingRepository();
export const assembliesKitsRepository = new AssembliesKitsRepository();
export const warehouseRepository = new WarehouseRepository();
export const subscriptionRepository = new SubscriptionRepository();
export const subscriptionItemRepository = new SubscriptionItemRepository();
export const invoiceRepository = new InvoiceRepository();
export const paymentRepository = new PaymentRepository();
export const sspAnalyticsRepository = new SSPAnalyticsRepository();
export const glIntegrationRepository = new GLIntegrationRepository();
export const revenueForecastingRepository = new RevenueForecastingRepository();
export const churnPredictionRepository = new ChurnPredictionRepository();
export const cohortAnalysisRepository = new CohortAnalysisRepository();
export const contractModificationRepository = new ContractModificationRepository();
export const scenarioAnalysisRepository = new ScenarioAnalysisRepository();
export const accountingPeriodRepository = new AccountingPeriodRepository();
