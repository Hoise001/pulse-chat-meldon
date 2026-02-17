import { t } from '../../utils/trpc';
import { acceptInstanceRoute } from './accept-instance';
import { addInstanceRoute } from './add-instance';
import { blockInstanceRoute } from './block-instance';
import { discoverRemoteRoute } from './discover-remote';
import { ensureShadowUserRoute } from './ensure-shadow-user';
import { onFederationInstanceUpdateRoute } from './events';
import { generateKeysRoute } from './generate-keys';
import { getConfigRoute } from './get-config';
import { joinRemoteRoute } from './join-remote';
import { listInstancesRoute } from './list-instances';
import { removeInstanceRoute } from './remove-instance';
import { requestTokenRoute } from './request-token';
import { setConfigRoute } from './set-config';

export const federationRouter = t.router({
  getConfig: getConfigRoute,
  setConfig: setConfigRoute,
  generateKeys: generateKeysRoute,
  listInstances: listInstancesRoute,
  addInstance: addInstanceRoute,
  acceptInstance: acceptInstanceRoute,
  removeInstance: removeInstanceRoute,
  blockInstance: blockInstanceRoute,
  requestToken: requestTokenRoute,
  discoverRemote: discoverRemoteRoute,
  joinRemote: joinRemoteRoute,
  ensureShadowUser: ensureShadowUserRoute,
  onInstanceUpdate: onFederationInstanceUpdateRoute
});
