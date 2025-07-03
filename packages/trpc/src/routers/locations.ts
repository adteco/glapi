import { authenticatedProcedure, router } from '../trpc';

export const locationsRouter = router({
  list: authenticatedProcedure.query(async () => {
    // TODO: Implement
    return [];
  }),
});