import { t } from '../../utils/trpc';
import { acceptRequestRoute } from './accept-request';
import {
  onFriendRemovedRoute,
  onFriendRequestAcceptedRoute,
  onFriendRequestReceivedRoute,
  onFriendRequestRejectedRoute
} from './events';
import { getFriendsRoute } from './get-friends';
import { getRequestsRoute } from './get-requests';
import { rejectRequestRoute } from './reject-request';
import { removeFriendRoute } from './remove-friend';
import { sendRequestRoute } from './send-request';

export const friendsRouter = t.router({
  getAll: getFriendsRoute,
  getRequests: getRequestsRoute,
  sendRequest: sendRequestRoute,
  acceptRequest: acceptRequestRoute,
  rejectRequest: rejectRequestRoute,
  remove: removeFriendRoute,
  onRequestReceived: onFriendRequestReceivedRoute,
  onRequestAccepted: onFriendRequestAcceptedRoute,
  onRequestRejected: onFriendRequestRejectedRoute,
  onRemoved: onFriendRemovedRoute
});
