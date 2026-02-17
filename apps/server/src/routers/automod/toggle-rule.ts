import { Permission } from '@pulse/shared';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { automodRules } from '../../db/schema';
import { protectedProcedure } from '../../utils/trpc';

const toggleAutomodRuleRoute = protectedProcedure
  .input(
    z.object({
      ruleId: z.number(),
      enabled: z.boolean()
    })
  )
  .mutation(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.MANAGE_AUTOMOD);

    const [updated] = await db
      .update(automodRules)
      .set({ enabled: input.enabled, updatedAt: Date.now() })
      .where(
        and(
          eq(automodRules.id, input.ruleId),
          eq(automodRules.serverId, ctx.activeServerId!)
        )
      )
      .returning();

    return updated;
  });

export { toggleAutomodRuleRoute };
