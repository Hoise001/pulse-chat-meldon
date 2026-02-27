import { store } from '@/features/store';
import type { TJoinedPublicUser } from '@pulse/shared';
import { serverSliceActions } from '../slice';

export const setUsers = (users: TJoinedPublicUser[]) => {
  store.dispatch(serverSliceActions.setUsers(users));
};

export const addUser = (user: TJoinedPublicUser) => {
  store.dispatch(serverSliceActions.addUser(user));
};

export const removeUser = (userId: number) => {
  store.dispatch(serverSliceActions.removeUser(userId));
};

export const updateUser = (
  userId: number,
  user: Partial<TJoinedPublicUser>
) => {
  store.dispatch(serverSliceActions.updateUser({ userId, user }));
};

export const handleUserJoin = (
  user: TJoinedPublicUser,
  serverId: number
) => {
  // If this USER_JOIN is scoped to the current active server, ensure the user
  // is present in the member list. This covers both the "new member joined"
  // case (addUser is a no-op if they already exist) and the "existing member
  // came online" case (updateUser refreshes their status).
  const state = store.getState();
  if (state.app.activeServerId === serverId) {
    addUser(user);
  }
  updateUser(user.id, user);
};
