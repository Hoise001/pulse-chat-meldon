import { Permission, ServerEvents } from '@pulse/shared';
import { eq } from 'drizzle-orm';
import z from 'zod';
import { db } from '../../db';
import { deleteShadowUsersByInstance } from '../../db/mutations/federation';
import { getFirstServer } from '../../db/queries/servers';
import { federationInstances } from '../../db/schema';
import { invalidateCorsCache } from '../../http/cors';
import { pubsub } from '../../utils/pubsub';
import { protectedProcedure } from '../../utils/trpc';

const blockInstanceRoute = protectedProcedure
  .input(
    z.object({
      instanceId: z.number()
    })
  )
  .mutation(async ({ ctx, input }) => {
    const server = await getFirstServer();
    await ctx.needsPermission(Permission.MANAGE_SETTINGS, server?.id);

    // Delete shadow users from this instance
    await deleteShadowUsersByInstance(input.instanceId);

    // Update status to blocked
    await db
      .update(federationInstances)
      .set({
        status: 'blocked',
        updatedAt: Date.now()
      })
      .where(eq(federationInstances.id, input.instanceId));

    invalidateCorsCache();

    pubsub.publish(ServerEvents.FEDERATION_INSTANCE_UPDATE, {
      instanceId: input.instanceId,
      status: 'blocked'
    });

    return { success: true };
  });

export { blockInstanceRoute };
