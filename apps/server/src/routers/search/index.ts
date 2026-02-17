import { t } from '../../utils/trpc';
import { searchMessagesRoute } from './search-messages';

export const searchRouter = t.router({
  messages: searchMessagesRoute
});
