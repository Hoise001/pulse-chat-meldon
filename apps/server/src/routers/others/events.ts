import { ServerEvents } from '@pulse/shared';
import { protectedProcedure } from '../../utils/trpc';

const onServerSettingsUpdateRoute = protectedProcedure.subscription(
  async ({ ctx }) => {
    return ctx.pubsub.subscribeFor(
      ctx.userId,
      ServerEvents.SERVER_SETTINGS_UPDATE
    );
  }
);

export { onServerSettingsUpdateRoute };
