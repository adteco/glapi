import { authenticatedProcedure, router } from '../trpc';

export const subsidiariesRouter = router({
  list: authenticatedProcedure.query(async () => {
    // TODO: Implement
    return [];
  }),
});