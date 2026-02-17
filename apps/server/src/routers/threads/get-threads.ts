import { ChannelType } from '@pulse/shared';
import { and, count, desc, eq, max } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { channels, messages } from '../../db/schema';
import { protectedProcedure } from '../../utils/trpc';

const getThreadsRoute = protectedProcedure
  .input(
    z.object({
      channelId: z.number(),
      includeArchived: z.boolean().optional().default(false)
    })
  )
  .query(async ({ input }) => {
    const conditions = [
      eq(channels.parentChannelId, input.channelId),
      eq(channels.type, ChannelType.THREAD)
    ];

    if (!input.includeArchived) {
      conditions.push(eq(channels.archived, false));
    }

    const threads = await db
      .select({
        id: channels.id,
        name: channels.name,
        archived: channels.archived,
        parentChannelId: channels.parentChannelId,
        createdAt: channels.createdAt,
        messageCount: count(messages.id),
        lastMessageAt: max(messages.createdAt)
      })
      .from(channels)
      .leftJoin(messages, eq(messages.channelId, channels.id))
      .where(and(...conditions))
      .groupBy(channels.id)
      .orderBy(desc(channels.createdAt));

    return threads.map((t) => ({
      id: t.id,
      name: t.name,
      messageCount: t.messageCount,
      lastMessageAt: t.lastMessageAt ? Number(t.lastMessageAt) : null,
      archived: t.archived,
      parentChannelId: t.parentChannelId!,
      createdAt: t.createdAt
    }));
  });

export { getThreadsRoute };
