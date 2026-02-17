import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { channelReadStates, channels, messages } from '../../db/schema';
import { protectedProcedure } from '../../utils/trpc';

const markServerAsReadRoute = protectedProcedure
  .input(
    z.object({
      serverId: z.number()
    })
  )
  .mutation(async ({ ctx, input }) => {
    const serverChannels = await db
      .select({ id: channels.id })
      .from(channels)
      .where(eq(channels.serverId, input.serverId));

    for (const channel of serverChannels) {
      const [newestMessage] = await db
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.channelId, channel.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      if (!newestMessage) continue;

      const [existingState] = await db
        .select()
        .from(channelReadStates)
        .where(
          and(
            eq(channelReadStates.channelId, channel.id),
            eq(channelReadStates.userId, ctx.userId)
          )
        )
        .limit(1);

      if (existingState) {
        await db
          .update(channelReadStates)
          .set({
            lastReadMessageId: newestMessage.id,
            lastReadAt: Date.now()
          })
          .where(
            and(
              eq(channelReadStates.channelId, channel.id),
              eq(channelReadStates.userId, ctx.userId)
            )
          );
      } else {
        await db.insert(channelReadStates).values({
          channelId: channel.id,
          userId: ctx.userId,
          lastReadMessageId: newestMessage.id,
          lastReadAt: Date.now()
        });
      }
    }
  });

export { markServerAsReadRoute };
