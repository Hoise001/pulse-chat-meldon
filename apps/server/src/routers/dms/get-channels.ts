import { getDmChannelsForUser } from '../../db/queries/dms';
import { protectedProcedure } from '../../utils/trpc';

const getChannelsRoute = protectedProcedure.query(async ({ ctx }) => {
  return getDmChannelsForUser(ctx.userId);
});

export { getChannelsRoute };
