import { Permission } from '@pulse/shared';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { webhooks } from '../../db/schema';
import { protectedProcedure } from '../../utils/trpc';

const deleteWebhookRoute = protectedProcedure
  .input(z.object({ webhookId: z.number() }))
  .mutation(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.MANAGE_WEBHOOKS);

    await db
      .delete(webhooks)
      .where(
        and(
          eq(webhooks.id, input.webhookId),
          eq(webhooks.serverId, ctx.activeServerId!)
        )
      );
  });

export { deleteWebhookRoute };
