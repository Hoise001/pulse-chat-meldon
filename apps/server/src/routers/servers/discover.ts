import { getDiscoverableServers } from '../../db/queries/servers';
import { protectedProcedure } from '../../utils/trpc';

const discoverServersRoute = protectedProcedure.query(async ({ ctx }) => {
  return getDiscoverableServers(ctx.userId);
});

export { discoverServersRoute };
