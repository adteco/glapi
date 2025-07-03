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
});

export type AppRouter = typeof appRouter;