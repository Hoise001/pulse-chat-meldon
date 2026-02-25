import { Permission, ServerEvents } from '@pulse/shared';
import { eq } from 'drizzle-orm';
import z from 'zod';
import { db } from '../../db';
import { removeFile } from '../../db/mutations/files';
import { getServerPublicSettings } from '../../db/queries/server';
import { getServerById, getServerMemberIds } from '../../db/queries/servers';
import { servers } from '../../db/schema';
import { invariant } from '../../utils/invariant';
import { fileManager } from '../../utils/file-manager';
import { protectedProcedure } from '../../utils/trpc';

const changeBannerRoute = protectedProcedure
  .input(
    z.object({
      serverId: z.number(),
      fileId: z.string().optional()
    })
  )
  .mutation(async ({ ctx, input }) => {
    const server = await getServerById(input.serverId);

    invariant(server, {
      code: 'NOT_FOUND',
      message: 'Server not found'
    });

    await ctx.needsPermission(Permission.MANAGE_SETTINGS, input.serverId);

    if (server.bannerId) {
      await removeFile(server.bannerId);
      await db
        .update(servers)
        .set({ bannerId: null, updatedAt: Date.now() })
        .where(eq(servers.id, input.serverId));
    }

    if (input.fileId) {
      const newFile = await fileManager.saveFile(input.fileId, ctx.userId);

      await db
        .update(servers)
        .set({ bannerId: newFile.id, updatedAt: Date.now() })
        .where(eq(servers.id, input.serverId));
    }

    // Publish to server members
    const publicSettings = await getServerPublicSettings(input.serverId);
    const memberIds = await getServerMemberIds(input.serverId);
    ctx.pubsub.publishFor(
      memberIds,
      ServerEvents.SERVER_SETTINGS_UPDATE,
      publicSettings
    );
  });

export { changeBannerRoute };
