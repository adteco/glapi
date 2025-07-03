import { authenticatedProcedure, router } from '../trpc';

export const warehousesRouter = router({
  list: authenticatedProcedure.query(async () => {
    // TODO: Implement
    return [];
  }),
});