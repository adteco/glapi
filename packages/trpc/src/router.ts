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
import { invoicesRouter } from './routers/invoices';
import { paymentsRouter } from './routers/payments';

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
  invoices: invoicesRouter,
  payments: paymentsRouter,
});

export type AppRouter = typeof appRouter;