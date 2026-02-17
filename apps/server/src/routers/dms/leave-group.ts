import { ServerEvents } from '@pulse/shared';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { getDmChannelMemberIds } from '../../db/queries/dms';
import { dmChannelMembers, dmChannels } from '../../db/schema';
import { pubsub } from '../../utils/pubsub';
import { protectedProcedure } from '../../utils/trpc';

const leaveGroupRoute = protectedProcedure
  .input(z.object({ dmChannelId: z.number() }))
  .mutation(async ({ input, ctx }) => {
    const [channel] = await db
      .select()
      .from(dmChannels)
      .where(eq(dmChannels.id, input.dmChannelId))
      .limit(1);

    if (!channel || !channel.isGroup) {
      return ctx.throwValidationError('dmChannelId', 'Group DM not found');
    }

    const memberIds = await getDmChannelMemberIds(input.dmChannelId);

    if (!memberIds.includes(ctx.userId)) {
      ctx.throwValidationError('dmChannelId', 'Not a member of this group');
    }

    // Remove the user
    await db
      .delete(dmChannelMembers)
      .where(
        and(
          eq(dmChannelMembers.dmChannelId, input.dmChannelId),
          eq(dmChannelMembers.userId, ctx.userId)
        )
      );

    // If the owner is leaving, transfer ownership to the next member
    if (channel.ownerId === ctx.userId) {
      const remainingMembers = memberIds.filter((id) => id !== ctx.userId);

      if (remainingMembers.length > 0) {
        await db
          .update(dmChannels)
          .set({ ownerId: remainingMembers[0], updatedAt: Date.now() })
          .where(eq(dmChannels.id, input.dmChannelId));
      } else {
        // No members left, delete the channel
        await db
          .delete(dmChannels)
          .where(eq(dmChannels.id, input.dmChannelId));

        return;
      }
    }

    // Notify remaining members
    const remainingMembers = memberIds.filter((id) => id !== ctx.userId);

    for (const userId of remainingMembers) {
      pubsub.publishFor(userId, ServerEvents.DM_MEMBER_REMOVE, {
        dmChannelId: input.dmChannelId,
        userId: ctx.userId
      });
    }
  });

export { leaveGroupRoute };
