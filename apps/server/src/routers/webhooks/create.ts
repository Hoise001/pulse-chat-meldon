import { Permission } from '@pulse/shared';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { db } from '../../db';
import { webhooks } from '../../db/schema';
import { protectedProcedure } from '../../utils/trpc';

const createWebhookRoute = protectedProcedure
  .input(
    z.object({
      name: z.string().min(1).max(80),
      channelId: z.number(),
      avatarFileId: z.number().optional()
    })
  )
  .mutation(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.MANAGE_WEBHOOKS);

    const [webhook] = await db
      .insert(webhooks)
      .values({
        name: input.name,
        channelId: input.channelId,
        token: randomUUID(),
        avatarFileId: input.avatarFileId ?? null,
        createdBy: ctx.userId,
        serverId: ctx.activeServerId!,
        createdAt: Date.now()
      })
      .returning();

    return webhook;
  });

export { createWebhookRoute };
