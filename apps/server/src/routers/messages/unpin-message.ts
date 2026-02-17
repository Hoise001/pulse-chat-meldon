import { ChannelPermission, Permission, ServerEvents } from '@pulse/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { publishMessage } from '../../db/publishers';
import { getAffectedUserIdsForChannel } from '../../db/queries/channels';
import { messages } from '../../db/schema';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const unpinMessageRoute = protectedProcedure
  .input(
    z.object({
      messageId: z.number()
    })
  )
  .mutation(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.PIN_MESSAGES);

    const [message] = await db
      .select({
        id: messages.id,
        channelId: messages.channelId,
        pinned: messages.pinned
      })
      .from(messages)
      .where(eq(messages.id, input.messageId))
      .limit(1);

    invariant(message, {
      code: 'NOT_FOUND',
      message: 'Message not found'
    });

    invariant(message.pinned, {
      code: 'BAD_REQUEST',
      message: 'Message is not pinned'
    });

    await db
      .update(messages)
      .set({
        pinned: false,
        pinnedAt: null,
        pinnedBy: null
      })
      .where(eq(messages.id, input.messageId));

    publishMessage(input.messageId, message.channelId, 'update');

    const affectedUserIds = await getAffectedUserIdsForChannel(
      message.channelId,
      { permission: ChannelPermission.VIEW_CHANNEL }
    );

    ctx.pubsub.publishFor(affectedUserIds, ServerEvents.MESSAGE_UNPIN, {
      messageId: input.messageId,
      channelId: message.channelId
    });
  });

export { unpinMessageRoute };
