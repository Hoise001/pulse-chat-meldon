import { z } from 'zod';
import { getServerMemberIds, isServerMember } from '../../db/queries/servers';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const getServerMembersRoute = protectedProcedure
  .input(
    z.object({
      serverId: z.number()
    })
  )
  .query(async ({ input, ctx }) => {
    const isMember = await isServerMember(input.serverId, ctx.userId);

    invariant(isMember, {
      code: 'FORBIDDEN',
      message: 'You are not a member of this server'
    });

    return getServerMemberIds(input.serverId);
  });

export { getServerMembersRoute };
