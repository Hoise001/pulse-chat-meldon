import { Permission } from '@pulse/shared';
import { z } from 'zod';
import { getRolesForServer } from '../../db/queries/roles';
import { protectedProcedure } from '../../utils/trpc';

const getRolesRouter = protectedProcedure
  .input(
    z.object({
      serverId: z.number()
    })
  )
  .query(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.MANAGE_ROLES, input.serverId);

    const roles = await getRolesForServer(input.serverId);

    return roles;
  });

export { getRolesRouter };
