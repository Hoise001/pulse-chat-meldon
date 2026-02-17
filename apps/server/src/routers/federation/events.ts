import { ServerEvents } from '@pulse/shared';
import { protectedProcedure } from '../../utils/trpc';

const onFederationInstanceUpdateRoute = protectedProcedure.subscription(
  async ({ ctx }) => {
    return ctx.pubsub.subscribe(ServerEvents.FEDERATION_INSTANCE_UPDATE);
  }
);

export { onFederationInstanceUpdateRoute };
