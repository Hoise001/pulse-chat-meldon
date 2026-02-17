import { getServersByUserId } from '../../db/queries/servers';
import { protectedProcedure } from '../../utils/trpc';

const getAllServersRoute = protectedProcedure.query(async ({ ctx }) => {
  return getServersByUserId(ctx.userId);
});

export { getAllServersRoute };
