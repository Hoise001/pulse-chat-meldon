import { ChannelPermission } from '@pulse/shared';
import { z } from 'zod';
import { getAffectedUserIdsForChannel } from '../../db/queries/channels';
import { protectedProcedure } from '../../utils/trpc';

const getVisibleUsersRoute = protectedProcedure
  .input(z.object({ channelId: z.number() }))
  .query(async ({ input }) => {
    const userIds = await getAffectedUserIdsForChannel(input.channelId, {
      permission: ChannelPermission.VIEW_CHANNEL
    });

    return userIds;
  });

export { getVisibleUsersRoute };
