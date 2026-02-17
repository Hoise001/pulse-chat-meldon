import { t } from '../../utils/trpc';
import { addNoteRoute } from './add-note';
import { deleteNoteRoute } from './delete-note';
import { getNotesRoute } from './get-notes';

export const notesRouter = t.router({
  getAll: getNotesRoute,
  add: addNoteRoute,
  delete: deleteNoteRoute
});
