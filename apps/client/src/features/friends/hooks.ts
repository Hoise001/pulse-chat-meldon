import { useSelector } from 'react-redux';
import {
  friendRequestsSelector,
  friendsLoadingSelector,
  friendsSelector
} from './selectors';

export const useFriends = () => useSelector(friendsSelector);

export const useFriendRequests = () => useSelector(friendRequestsSelector);

export const useFriendsLoading = () => useSelector(friendsLoadingSelector);
