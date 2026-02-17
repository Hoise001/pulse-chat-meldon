import { getFriends } from '../../db/queries/friends';
import { protectedProcedure } from '../../utils/trpc';

const getFriendsRoute = protectedProcedure.query(async ({ ctx }) => {
  return getFriends(ctx.userId);
});

export { getFriendsRoute };
