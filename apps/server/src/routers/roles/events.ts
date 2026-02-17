import { ServerEvents } from '@pulse/shared';
import { protectedProcedure } from '../../utils/trpc';

const onRoleCreateRoute = protectedProcedure.subscription(async ({ ctx }) => {
  return ctx.pubsub.subscribeFor(ctx.userId, ServerEvents.ROLE_CREATE);
});

const onRoleDeleteRoute = protectedProcedure.subscription(async ({ ctx }) => {
  return ctx.pubsub.subscribeFor(ctx.userId, ServerEvents.ROLE_DELETE);
});

const onRoleUpdateRoute = protectedProcedure.subscription(async ({ ctx }) => {
  return ctx.pubsub.subscribeFor(ctx.userId, ServerEvents.ROLE_UPDATE);
});

export { onRoleCreateRoute, onRoleDeleteRoute, onRoleUpdateRoute };
