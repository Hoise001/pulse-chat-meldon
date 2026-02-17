import { ServerEvents } from '@pulse/shared';
import { z } from 'zod';
import { db } from '../../db';
import { getDefaultRoleForServer } from '../../db/queries/roles';
import {
  addServerMember,
  getServerById,
  getServersByUserId,
  isServerMember
} from '../../db/queries/servers';
import { userRoles } from '../../db/schema';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const joinDiscoverRoute = protectedProcedure
  .input(
    z.object({
      serverId: z.number()
    })
  )
  .mutation(async ({ input, ctx }) => {
    const server = await getServerById(input.serverId);

    invariant(server, {
      code: 'NOT_FOUND',
      message: 'Server not found'
    });

    invariant(server.discoverable, {
      code: 'FORBIDDEN',
      message: 'This server is not discoverable'
    });

    invariant(server.allowNewUsers, {
      code: 'FORBIDDEN',
      message: 'This server is not accepting new members'
    });

    // Check if already a member
    const alreadyMember = await isServerMember(server.id, ctx.userId);

    if (alreadyMember) {
      const servers = await getServersByUserId(ctx.userId);
      return servers.find((s) => s.id === server.id)!;
    }

    // Add member
    await addServerMember(server.id, ctx.userId);

    // Assign default role
    const defaultRole = await getDefaultRoleForServer(server.id);
    if (defaultRole) {
      await db
        .insert(userRoles)
        .values({
          userId: ctx.userId,
          roleId: defaultRole.id,
          createdAt: Date.now()
        })
        .onConflictDoNothing();
    }

    // Return updated server summary
    const servers = await getServersByUserId(ctx.userId);
    const summary = servers.find((s) => s.id === server.id)!;

    ctx.pubsub.publishFor(ctx.userId, ServerEvents.SERVER_MEMBER_JOIN, {
      serverId: server.id,
      userId: ctx.userId,
      server: summary
    });

    return summary;
  });

export { joinDiscoverRoute };
