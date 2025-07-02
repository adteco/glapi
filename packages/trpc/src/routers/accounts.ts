import { authenticatedProcedure, router } from '../trpc';

export const accountsRouter = router({
  list: authenticatedProcedure.query(async () => {
    // TODO: Implement
    return [];
  }),
});