import { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { router } from './trpc';
import { customersRouter } from './routers/customers';
import { organizationsRouter } from './routers/organizations';
import { subsidiariesRouter } from './routers/subsidiaries';
import { departmentsRouter } from './routers/departments';
import { locationsRouter } from './routers/locations';
import { classesRouter } from './routers/classes';
import { itemsRouter } from './routers/items';
import { priceListsRouter } from './routers/price-lists';
import { warehousesRouter } from './routers/warehouses';
import { vendorsRouter } from './routers/vendors';
import { accountsRouter } from './routers/accounts';
import { leadsRouter } from './routers/leads';
import { employeesRouter } from './routers/employees';
import { prospectsRouter } from './routers/prospects';
import { contactsRouter } from './routers/contacts';
import { unitsOfMeasureRouter } from './routers/units-of-measure';
import { businessTransactionsRouter } from './routers/business-transactions';
import { subscriptionsRouter } from './routers/subscriptions';
import { billingSchedulesRouter } from './routers/billing-schedules';
import { invoicesRouter } from './routers/invoices';
import { paymentsRouter } from './routers/payments';
import { revenueRouter } from './routers/revenue';
import { accountingPeriodsRouter } from './routers/accounting-periods';
import { projectCostCodesRouter } from './routers/project-cost-codes';
import { projectBudgetsRouter } from './routers/project-budgets';
import { projectsRouter } from './routers/projects';
import { projectTypesRouter } from './routers/project-types';
import { projectReportingRouter } from './routers/project-reporting';
import { projectAnalyticsRouter } from './routers/project-analytics';
import { timeEntriesRouter } from './routers/time-entries';
import { expenseEntriesRouter } from './routers/expense-entries';
import { closeManagementRouter } from './routers/close-management';
import { scheduleOfValuesRouter } from './routers/schedule-of-values';
import { payApplicationsRouter } from './routers/pay-applications';
import { auditRouter } from './routers/audit';
import { jobCostPostingRouter } from './routers/job-cost-posting';
import { changeManagementRouter } from './routers/change-management';
import { wipReportingRouter } from './routers/wip-reporting';
import { consolidationRouter } from './routers/consolidation';
import { metricsRouter } from './routers/metrics';
import { salesOrdersRouter } from './routers/sales-orders';
import { bankDepositsRouter } from './routers/bank-deposits';
import { reportSchedulesRouter } from './routers/report-schedules';
import { deliveryQueueRouter } from './routers/delivery-queue';
import { importsRouter } from './routers/imports';
import { onboardingRouter } from './routers/onboarding';
import { estimatesRouter } from './routers/estimates';
import { accountingListsRouter } from './routers/accounting-lists';
import { globalSearchRouter } from './routers/global-search';
import { workflowsRouter } from './routers/workflows';
import { taskFieldsRouter } from './routers/task-fields';
import { taskTemplatesRouter } from './routers/task-templates';
import { entityTasksRouter } from './routers/entity-tasks';
import { financialStatementsRouter } from './routers/financial-statements';
import { savedReportConfigsRouter } from './routers/saved-report-configs';
import { emailTemplatesRouter } from './routers/email-templates';
import { communicationEventsRouter } from './routers/communication-events';
import { communicationWorkflowsRouter } from './routers/communication-workflows';
import { entityContactsRouter } from './routers/entity-contacts';
import { pendingDocumentsRouter } from './routers/pending-documents';

export const appRouter = router({
  customers: customersRouter,
  organizations: organizationsRouter,
  subsidiaries: subsidiariesRouter,
  departments: departmentsRouter,
  locations: locationsRouter,
  classes: classesRouter,
  items: itemsRouter,
  priceLists: priceListsRouter,
  warehouses: warehousesRouter,
  vendors: vendorsRouter,
  accounts: accountsRouter,
  leads: leadsRouter,
  employees: employeesRouter,
  prospects: prospectsRouter,
  contacts: contactsRouter,
  unitsOfMeasure: unitsOfMeasureRouter,
  businessTransactions: businessTransactionsRouter,
  subscriptions: subscriptionsRouter,
  billingSchedules: billingSchedulesRouter,
  invoices: invoicesRouter,
  payments: paymentsRouter,
  revenue: revenueRouter,
  accountingPeriods: accountingPeriodsRouter,
  projects: projectsRouter,
  projectTypes: projectTypesRouter,
  projectCostCodes: projectCostCodesRouter,
  projectBudgets: projectBudgetsRouter,
  projectReporting: projectReportingRouter,
  projectAnalytics: projectAnalyticsRouter,
  timeEntries: timeEntriesRouter,
  expenseEntries: expenseEntriesRouter,
  closeManagement: closeManagementRouter,
  scheduleOfValues: scheduleOfValuesRouter,
  payApplications: payApplicationsRouter,
  audit: auditRouter,
  jobCostPosting: jobCostPostingRouter,
  changeManagement: changeManagementRouter,
  wipReporting: wipReportingRouter,
  consolidation: consolidationRouter,
  metrics: metricsRouter,
  salesOrders: salesOrdersRouter,
  bankDeposits: bankDepositsRouter,
  reportSchedules: reportSchedulesRouter,
  deliveryQueue: deliveryQueueRouter,
  imports: importsRouter,
  onboarding: onboardingRouter,
  estimates: estimatesRouter,
  accountingLists: accountingListsRouter,
  globalSearch: globalSearchRouter,
  workflows: workflowsRouter,
  taskFields: taskFieldsRouter,
  taskTemplates: taskTemplatesRouter,
  entityTasks: entityTasksRouter,
  financialStatements: financialStatementsRouter,
  savedReportConfigs: savedReportConfigsRouter,
  emailTemplates: emailTemplatesRouter,
  communicationEvents: communicationEventsRouter,
  communicationWorkflows: communicationWorkflowsRouter,
  entityContacts: entityContactsRouter,
  pendingDocuments: pendingDocumentsRouter,
});

export type AppRouter = typeof appRouter;

/**
 * TRPC Type Inference Utilities
 *
 * Use these to get compile-time type safety in components.
 * ALWAYS use these instead of defining duplicate interfaces.
 *
 * @example
 * // Get the output type of customers.list
 * type CustomerList = RouterOutputs['customers']['list'];
 *
 * // Get a single customer from the list
 * type Customer = RouterOutputs['customers']['list'][number];
 *
 * // Get the input type for create mutation
 * type CreateCustomerInput = RouterInputs['customers']['create'];
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
