import { Permission } from '@pulse/shared';
import { stringify } from 'ini';
import fs from 'node:fs/promises';
import z from 'zod';
import { config } from '../../config';
import { getFirstServer } from '../../db/queries/servers';
import { CONFIG_INI_PATH } from '../../helpers/paths';
import { logger } from '../../logger';
import {
  generateFederationKeys,
  getLocalKeys
} from '../../utils/federation';
import { protectedProcedure } from '../../utils/trpc';

const setConfigRoute = protectedProcedure
  .input(
    z.object({
      enabled: z.boolean(),
      domain: z.string().min(1)
    })
  )
  .mutation(async ({ ctx, input }) => {
    try {
      logger.info('[federation/setConfig] called by userId=%d, input=%o', ctx.userId, input);

      const server = await getFirstServer();
      logger.info('[federation/setConfig] firstServer id=%s, ownerId=%s', server?.id, server?.ownerId);

      await ctx.needsPermission(Permission.MANAGE_SETTINGS, server?.id);
      logger.info('[federation/setConfig] permission check passed');

      // Mutate config in memory
      logger.info('[federation/setConfig] config.federation before: %o', config.federation);
      config.federation.enabled = input.enabled;
      config.federation.domain = input.domain;
      logger.info('[federation/setConfig] config.federation after: %o', config.federation);

      // Persist to INI file
      logger.info('[federation/setConfig] writing INI to %s', CONFIG_INI_PATH);
      await fs.writeFile(CONFIG_INI_PATH, stringify(config as Record<string, unknown>));
      logger.info('[federation/setConfig] INI written successfully');

      // Auto-generate keys if enabling and none exist
      if (input.enabled) {
        const keys = await getLocalKeys();
        logger.info('[federation/setConfig] existing keys: %s', keys ? 'yes' : 'no');
        if (!keys) {
          logger.info('[federation/setConfig] generating federation keys...');
          await generateFederationKeys();
          logger.info('[federation/setConfig] keys generated');
        }
      }

      logger.info('[federation/setConfig] success');
      return { success: true };
    } catch (error) {
      logger.error('[federation/setConfig] error: %o', error);
      throw error;
    }
  });

export { setConfigRoute };
