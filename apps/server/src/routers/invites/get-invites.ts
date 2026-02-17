import { Permission } from '@pulse/shared';
import { z } from 'zod';
import { getInvites } from '../../db/queries/invites';
import { protectedProcedure } from '../../utils/trpc';

const getInvitesRoute = protectedProcedure
  .input(
    z.object({
      serverId: z.number()
    })
  )
  .query(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.MANAGE_INVITES, input.serverId);

    const invites = await getInvites(input.serverId);

    return invites;
  });

export { getInvitesRoute };
