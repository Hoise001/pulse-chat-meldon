import { Permission, type TStorageSettings } from '@pulse/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { servers } from '../../db/schema';
import { getDiskMetrics } from '../../utils/metrics';
import { protectedProcedure } from '../../utils/trpc';

const getStorageSettingsRoute = protectedProcedure
  .input(
    z.object({
      serverId: z.number()
    })
  )
  .query(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.MANAGE_STORAGE, input.serverId);

    const [[server], diskMetrics] = await Promise.all([
      db
        .select()
        .from(servers)
        .where(eq(servers.id, input.serverId))
        .limit(1),
      getDiskMetrics()
    ]);

    if (!server) {
      throw new Error('Server not found');
    }

    const storageSettings: TStorageSettings = {
      storageUploadEnabled: server.storageUploadEnabled,
      storageUploadMaxFileSize: server.storageUploadMaxFileSize,
      storageSpaceQuotaByUser: server.storageSpaceQuotaByUser,
      storageOverflowAction: server.storageOverflowAction,
      storageQuota: server.storageQuota
    };

    return { storageSettings, diskMetrics };
  });

export { getStorageSettingsRoute };
