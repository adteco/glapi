import { authenticatedProcedure, router } from '../trpc';

export const departmentsRouter = router({
  list: authenticatedProcedure.query(async () => {
    // TODO: Implement
    return [];
  }),
});