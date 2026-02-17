import { Permission } from '@pulse/shared';
import { z } from 'zod';
import { getEmojis } from '../../db/queries/emojis';
import { protectedProcedure } from '../../utils/trpc';

const getEmojisRoute = protectedProcedure
  .input(z.object({ serverId: z.number() }))
  .query(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.MANAGE_EMOJIS, input.serverId);

    const emojis = await getEmojis(input.serverId);

    return emojis;
  });

export { getEmojisRoute };
