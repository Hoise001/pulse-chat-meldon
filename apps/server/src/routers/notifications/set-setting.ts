import { z } from 'zod';
import { db } from '../../db';
import { channelNotificationSettings } from '../../db/schema';
import { protectedProcedure } from '../../utils/trpc';

const setNotificationSettingRoute = protectedProcedure
  .input(
    z.object({
      channelId: z.number(),
      level: z.enum(['all', 'mentions', 'nothing', 'default'])
    })
  )
  .mutation(async ({ ctx, input }) => {
    await db
      .insert(channelNotificationSettings)
      .values({
        userId: ctx.userId,
        channelId: input.channelId,
        level: input.level,
        createdAt: Date.now()
      })
      .onConflictDoUpdate({
        target: [
          channelNotificationSettings.userId,
          channelNotificationSettings.channelId
        ],
        set: {
          level: input.level,
          updatedAt: Date.now()
        }
      });
  });

export { setNotificationSettingRoute };
