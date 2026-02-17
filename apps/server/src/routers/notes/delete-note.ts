import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { userNotes } from '../../db/schema';
import { protectedProcedure } from '../../utils/trpc';

const deleteNoteRoute = protectedProcedure
  .input(
    z.object({
      noteId: z.number()
    })
  )
  .mutation(async ({ ctx, input }) => {
    await db
      .delete(userNotes)
      .where(
        and(
          eq(userNotes.id, input.noteId),
          eq(userNotes.authorId, ctx.userId)
        )
      );
  });

export { deleteNoteRoute };
