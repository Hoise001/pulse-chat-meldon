import { NotificationLevel } from '@pulse/shared';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { channelNotificationSettings } from '../../db/schema';
import { protectedProcedure } from '../../utils/trpc';

const getNotificationSettingRoute = protectedProcedure
  .input(
    z.object({
      channelId: z.number()
    })
  )
  .query(async ({ ctx, input }) => {
    const [setting] = await db
      .select({ level: channelNotificationSettings.level })
      .from(channelNotificationSettings)
      .where(
        and(
          eq(channelNotificationSettings.userId, ctx.userId),
          eq(channelNotificationSettings.channelId, input.channelId)
        )
      )
      .limit(1);

    return { level: (setting?.level ?? NotificationLevel.DEFAULT) as NotificationLevel };
  });

export { getNotificationSettingRoute };
