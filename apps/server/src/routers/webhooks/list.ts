import { Permission } from '@pulse/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { webhooks } from '../../db/schema';
import { protectedProcedure } from '../../utils/trpc';

const listWebhooksRoute = protectedProcedure
  .input(
    z.object({
      channelId: z.number().optional()
    })
  )
  .query(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.MANAGE_WEBHOOKS);

    if (input.channelId) {
      return db
        .select()
        .from(webhooks)
        .where(eq(webhooks.channelId, input.channelId));
    }

    return db
      .select()
      .from(webhooks)
      .where(eq(webhooks.serverId, ctx.activeServerId!));
  });

export { listWebhooksRoute };
