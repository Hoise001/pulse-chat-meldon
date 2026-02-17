import { Permission } from '@pulse/shared';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { automodRules } from '../../db/schema';
import { protectedProcedure } from '../../utils/trpc';

const deleteAutomodRuleRoute = protectedProcedure
  .input(z.object({ ruleId: z.number() }))
  .mutation(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.MANAGE_AUTOMOD);

    await db
      .delete(automodRules)
      .where(
        and(
          eq(automodRules.id, input.ruleId),
          eq(automodRules.serverId, ctx.activeServerId!)
        )
      );
  });

export { deleteAutomodRuleRoute };
