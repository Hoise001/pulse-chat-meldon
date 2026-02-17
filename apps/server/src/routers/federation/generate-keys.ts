import { Permission } from '@pulse/shared';
import { getFirstServer } from '../../db/queries/servers';
import { generateFederationKeys, getLocalKeys } from '../../utils/federation';
import { protectedProcedure } from '../../utils/trpc';

const generateKeysRoute = protectedProcedure.mutation(async ({ ctx }) => {
  const server = await getFirstServer();
  await ctx.needsPermission(Permission.MANAGE_SETTINGS, server?.id);

  const existing = await getLocalKeys();
  if (existing) {
    ctx.throwValidationError('keys', 'Federation keys already exist');
  }

  const keys = await generateFederationKeys();

  return { publicKey: keys.publicKey };
});

export { generateKeysRoute };
