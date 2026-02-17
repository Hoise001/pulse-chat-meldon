import { ServerEvents } from '@pulse/shared';
import { protectedProcedure } from '../../utils/trpc';

const onFriendRequestReceivedRoute = protectedProcedure.subscription(
  async ({ ctx }) => {
    return ctx.pubsub.subscribeFor(
      ctx.userId,
      ServerEvents.FRIEND_REQUEST_RECEIVED
    );
  }
);

const onFriendRequestAcceptedRoute = protectedProcedure.subscription(
  async ({ ctx }) => {
    return ctx.pubsub.subscribeFor(
      ctx.userId,
      ServerEvents.FRIEND_REQUEST_ACCEPTED
    );
  }
);

const onFriendRequestRejectedRoute = protectedProcedure.subscription(
  async ({ ctx }) => {
    return ctx.pubsub.subscribeFor(
      ctx.userId,
      ServerEvents.FRIEND_REQUEST_REJECTED
    );
  }
);

const onFriendRemovedRoute = protectedProcedure.subscription(
  async ({ ctx }) => {
    return ctx.pubsub.subscribeFor(ctx.userId, ServerEvents.FRIEND_REMOVED);
  }
);

export {
  onFriendRemovedRoute,
  onFriendRequestAcceptedRoute,
  onFriendRequestReceivedRoute,
  onFriendRequestRejectedRoute
};
