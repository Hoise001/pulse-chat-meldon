import { ActivityLogType, Permission } from '@pulse/shared';
import { z } from 'zod';
import { db } from '../../db';
import { publishRole } from '../../db/publishers';
import { roles } from '../../db/schema';
import { enqueueActivityLog } from '../../queues/activity-log';
import { protectedProcedure } from '../../utils/trpc';

const addRoleRoute = protectedProcedure
  .input(
    z.object({
      serverId: z.number()
    })
  )
  .mutation(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.MANAGE_ROLES, input.serverId);

    const [role] = await db
      .insert(roles)
      .values({
        name: 'New Role',
        color: '#ffffff',
        isDefault: false,
        isPersistent: false,
        serverId: input.serverId,
        createdAt: Date.now()
      })
      .returning();

    publishRole(role!.id, 'create');
    enqueueActivityLog({
      type: ActivityLogType.CREATED_ROLE,
      userId: ctx.user.id,
      details: {
        roleId: role!.id,
        roleName: role!.name
      }
    });

    return role!.id;
  });

export { addRoleRoute };
