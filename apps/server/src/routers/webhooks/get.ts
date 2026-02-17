import { Permission } from '@pulse/shared';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { webhooks } from '../../db/schema';
import { protectedProcedure } from '../../utils/trpc';

const getWebhookRoute = protectedProcedure
  .input(z.object({ webhookId: z.number() }))
  .query(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.MANAGE_WEBHOOKS);

    const [webhook] = await db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.id, input.webhookId),
          eq(webhooks.serverId, ctx.activeServerId!)
        )
      )
      .limit(1);

    return webhook ?? null;
  });

export { getWebhookRoute };
