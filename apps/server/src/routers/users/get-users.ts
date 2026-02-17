import { Permission } from '@pulse/shared';
import { getUsers } from '../../db/queries/users';
import { clearFields } from '../../helpers/clear-fields';
import { protectedProcedure } from '../../utils/trpc';

const getUsersRoute = protectedProcedure.query(async ({ ctx }) => {
  await ctx.needsPermission(Permission.MANAGE_USERS);

  const users = await getUsers(ctx.activeServerId ?? undefined);

  return clearFields(users, ['supabaseId']);
});

export { getUsersRoute };
