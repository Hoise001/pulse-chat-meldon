import { getPendingRequests } from '../../db/queries/friends';
import { protectedProcedure } from '../../utils/trpc';

const getRequestsRoute = protectedProcedure.query(async ({ ctx }) => {
  return getPendingRequests(ctx.userId);
});

export { getRequestsRoute };
