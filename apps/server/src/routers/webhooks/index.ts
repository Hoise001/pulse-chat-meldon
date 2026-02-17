import { t } from '../../utils/trpc';
import { createWebhookRoute } from './create';
import { deleteWebhookRoute } from './delete';
import { getWebhookRoute } from './get';
import { listWebhooksRoute } from './list';
import { updateWebhookRoute } from './update';

export const webhooksRouter = t.router({
  create: createWebhookRoute,
  list: listWebhooksRoute,
  get: getWebhookRoute,
  update: updateWebhookRoute,
  delete: deleteWebhookRoute
});
