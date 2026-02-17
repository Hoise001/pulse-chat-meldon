import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { getServerById } from '../../db/queries/servers';
import { servers } from '../../db/schema';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const deleteServerRoute = protectedProcedure
  .input(
    z.object({
      serverId: z.number()
    })
  )
  .mutation(async ({ input, ctx }) => {
    const server = await getServerById(input.serverId);

    invariant(server, {
      code: 'NOT_FOUND',
      message: 'Server not found'
    });

    invariant(server.ownerId === ctx.userId, {
      code: 'FORBIDDEN',
      message: 'Only the server owner can delete the server'
    });

    await db.delete(servers).where(eq(servers.id, input.serverId));
  });

export { deleteServerRoute };
