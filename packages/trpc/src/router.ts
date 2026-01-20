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
import { projectReportingRouter } from './routers/project-reporting';
import { timeEntriesRouter } from './routers/time-entries';
import { expenseEntriesRouter } from './routers/expense-entries';
import { closeManagementRouter } from './routers/close-management';
import { scheduleOfValuesRouter } from './routers/schedule-of-values';
import { payApplicationsRouter } from './routers/pay-applications';
import { auditRouter } from './routers/audit';
import { jobCostPostingRouter } from './routers/job-cost-posting';
import { changeManagementRouter } from './routers/change-management';
import { wipReportingRouter } from './routers/wip-reporting';

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
  projectCostCodes: projectCostCodesRouter,
  projectBudgets: projectBudgetsRouter,
  projectReporting: projectReportingRouter,
  timeEntries: timeEntriesRouter,
  expenseEntries: expenseEntriesRouter,
  closeManagement: closeManagementRouter,
  scheduleOfValues: scheduleOfValuesRouter,
  payApplications: payApplicationsRouter,
  audit: auditRouter,
  jobCostPosting: jobCostPostingRouter,
  changeManagement: changeManagementRouter,
  wipReporting: wipReportingRouter,
});

export type AppRouter = typeof appRouter;
