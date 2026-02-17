import { AutomodRuleType, Permission } from '@pulse/shared';
import { z } from 'zod';
import { db } from '../../db';
import { automodRules } from '../../db/schema';
import { protectedProcedure } from '../../utils/trpc';

const createAutomodRuleRoute = protectedProcedure
  .input(
    z.object({
      name: z.string().min(1).max(100),
      type: z.nativeEnum(AutomodRuleType),
      config: z.object({
        keywords: z.array(z.string()).optional(),
        regexPatterns: z.array(z.string()).optional(),
        maxMentions: z.number().optional(),
        allowedLinks: z.array(z.string()).optional(),
        blockedLinks: z.array(z.string()).optional()
      }),
      actions: z.array(
        z.object({
          type: z.enum([
            'delete_message',
            'alert_channel',
            'timeout_user',
            'log'
          ]),
          channelId: z.number().optional(),
          duration: z.number().optional()
        })
      ),
      exemptRoleIds: z.array(z.number()).optional(),
      exemptChannelIds: z.array(z.number()).optional()
    })
  )
  .mutation(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.MANAGE_AUTOMOD);

    const [rule] = await db
      .insert(automodRules)
      .values({
        name: input.name,
        type: input.type,
        config: input.config,
        actions: input.actions,
        exemptRoleIds: input.exemptRoleIds ?? [],
        exemptChannelIds: input.exemptChannelIds ?? [],
        serverId: ctx.activeServerId!,
        createdBy: ctx.userId,
        createdAt: Date.now()
      })
      .returning();

    return rule;
  });

export { createAutomodRuleRoute };
