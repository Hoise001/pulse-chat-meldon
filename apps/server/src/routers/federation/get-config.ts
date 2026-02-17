import { Permission } from '@pulse/shared';
import { getFirstServer } from '../../db/queries/servers';
import { logger } from '../../logger';
import { getFederationConfig } from '../../utils/federation';
import { protectedProcedure } from '../../utils/trpc';

const getConfigRoute = protectedProcedure.query(async ({ ctx }) => {
  try {
    logger.info('[federation/getConfig] called by userId=%d', ctx.userId);
    const server = await getFirstServer();
    logger.info('[federation/getConfig] firstServer id=%s', server?.id);
    await ctx.needsPermission(Permission.MANAGE_SETTINGS, server?.id);
    logger.info('[federation/getConfig] permission check passed');

    const result = await getFederationConfig();
    logger.info('[federation/getConfig] returning config: %o', result);
    return result;
  } catch (error) {
    logger.error('[federation/getConfig] error: %o', error);
    throw error;
  }
});

export { getConfigRoute };
