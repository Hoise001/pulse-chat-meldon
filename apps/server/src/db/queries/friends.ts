import { and, eq, or } from 'drizzle-orm';
import { db } from '..';
import { friendRequests, friendships } from '../schema';
import { getPublicUserById } from './users';
import type { TJoinedFriendRequest, TJoinedPublicUser } from '@pulse/shared';

const getFriends = async (userId: number): Promise<TJoinedPublicUser[]> => {
  const rows = await db
    .select()
    .from(friendships)
    .where(
      or(eq(friendships.userId, userId), eq(friendships.friendId, userId))
    );

  const friendIds = rows.map((r) =>
    r.userId === userId ? r.friendId : r.userId
  );

  const friends: TJoinedPublicUser[] = [];

  for (const friendId of friendIds) {
    const user = await getPublicUserById(friendId);
    if (user) friends.push(user);
  }

  return friends;
};

const areFriends = async (
  userId: number,
  friendId: number
): Promise<boolean> => {
  const [row] = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.userId, userId), eq(friendships.friendId, friendId)),
        and(eq(friendships.userId, friendId), eq(friendships.friendId, userId))
      )
    )
    .limit(1);

  return !!row;
};

const getPendingRequests = async (
  userId: number
): Promise<TJoinedFriendRequest[]> => {
  const rows = await db
    .select()
    .from(friendRequests)
    .where(
      and(
        or(
          eq(friendRequests.senderId, userId),
          eq(friendRequests.receiverId, userId)
        ),
        eq(friendRequests.status, 'pending')
      )
    );

  const joined: TJoinedFriendRequest[] = [];

  for (const row of rows) {
    const sender = await getPublicUserById(row.senderId);
    const receiver = await getPublicUserById(row.receiverId);

    if (sender && receiver) {
      joined.push({ ...row, sender, receiver });
    }
  }

  return joined;
};

const getJoinedFriendRequest = async (
  requestId: number
): Promise<TJoinedFriendRequest | null> => {
  const [row] = await db
    .select()
    .from(friendRequests)
    .where(eq(friendRequests.id, requestId))
    .limit(1);

  if (!row) return null;

  const sender = await getPublicUserById(row.senderId);
  const receiver = await getPublicUserById(row.receiverId);

  if (!sender || !receiver) return null;

  return { ...row, sender, receiver };
};

export { areFriends, getFriends, getJoinedFriendRequest, getPendingRequests };
