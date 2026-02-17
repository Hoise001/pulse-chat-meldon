import { ServerEvents } from '@pulse/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { getDmChannelMemberIds } from '../../db/queries/dms';
import { dmChannels } from '../../db/schema';
import { pubsub } from '../../utils/pubsub';
import { protectedProcedure } from '../../utils/trpc';

const updateGroupRoute = protectedProcedure
  .input(
    z.object({
      dmChannelId: z.number(),
      name: z.string().max(100).optional(),
      iconFileId: z.number().nullable().optional()
    })
  )
  .mutation(async ({ input, ctx }) => {
    const [channel] = await db
      .select()
      .from(dmChannels)
      .where(eq(dmChannels.id, input.dmChannelId))
      .limit(1);

    if (!channel || !channel.isGroup) {
      return ctx.throwValidationError('dmChannelId', 'Group DM not found');
    }

    if (channel.ownerId !== ctx.userId) {
      return ctx.throwValidationError('dmChannelId', 'Only the group owner can update the group');
    }

    const updates: Partial<typeof dmChannels.$inferInsert> = {
      updatedAt: Date.now()
    };

    if (input.name !== undefined) updates.name = input.name;
    if (input.iconFileId !== undefined) updates.iconFileId = input.iconFileId;

    await db
      .update(dmChannels)
      .set(updates)
      .where(eq(dmChannels.id, input.dmChannelId));

    const memberIds = await getDmChannelMemberIds(input.dmChannelId);

    for (const userId of memberIds) {
      pubsub.publishFor(userId, ServerEvents.DM_CHANNEL_UPDATE, {
        dmChannelId: input.dmChannelId,
        name: input.name ?? channel.name,
        iconFileId: input.iconFileId ?? channel.iconFileId
      });
    }
  });

export { updateGroupRoute };
