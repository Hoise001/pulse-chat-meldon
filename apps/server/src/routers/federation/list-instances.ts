import { Permission } from '@pulse/shared';
import { listFederationInstances } from '../../db/queries/federation';
import { getFirstServer } from '../../db/queries/servers';
import { protectedProcedure } from '../../utils/trpc';

const listInstancesRoute = protectedProcedure.query(async ({ ctx }) => {
  const server = await getFirstServer();
  await ctx.needsPermission(Permission.MANAGE_SETTINGS, server?.id);

  const instances = await listFederationInstances();

  return instances.map((i) => ({
    id: i.id,
    domain: i.domain,
    name: i.name,
    status: i.status as 'pending' | 'active' | 'blocked',
    direction: i.direction as 'outgoing' | 'incoming' | 'mutual',
    lastSeenAt: i.lastSeenAt,
    createdAt: i.createdAt
  }));
});

export { listInstancesRoute };
