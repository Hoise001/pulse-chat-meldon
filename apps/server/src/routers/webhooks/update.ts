import { Permission } from '@pulse/shared';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { webhooks } from '../../db/schema';
import { protectedProcedure } from '../../utils/trpc';

const updateWebhookRoute = protectedProcedure
  .input(
    z.object({
      webhookId: z.number(),
      name: z.string().min(1).max(80).optional(),
      channelId: z.number().optional(),
      avatarFileId: z.number().nullable().optional()
    })
  )
  .mutation(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.MANAGE_WEBHOOKS);

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.channelId !== undefined) updates.channelId = input.channelId;
    if (input.avatarFileId !== undefined)
      updates.avatarFileId = input.avatarFileId;

    const [updated] = await db
      .update(webhooks)
      .set(updates)
      .where(
        and(
          eq(webhooks.id, input.webhookId),
          eq(webhooks.serverId, ctx.activeServerId!)
        )
      )
      .returning();

    return updated;
  });

export { updateWebhookRoute };
