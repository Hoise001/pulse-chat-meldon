import { Permission } from '@pulse/shared';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { automodRules } from '../../db/schema';
import { protectedProcedure } from '../../utils/trpc';

const listAutomodRulesRoute = protectedProcedure.query(async ({ ctx }) => {
  await ctx.needsPermission(Permission.MANAGE_AUTOMOD);

  return db
    .select()
    .from(automodRules)
    .where(eq(automodRules.serverId, ctx.activeServerId!));
});

export { listAutomodRulesRoute };
