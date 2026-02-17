import { ActivityLogType, type TJoinedUser } from '@pulse/shared';
import { randomUUIDv7 } from 'bun';
import { db } from '../db';
import { publishUser } from '../db/publishers';
import { getUserBySupabaseId } from '../db/queries/users';
import { users } from '../db/schema';
import { enqueueActivityLog } from '../queues/activity-log';
import { invariant } from '../utils/invariant';

const registerUser = async (
  supabaseUserId: string,
  inviteCode?: string,
  ip?: string,
  name?: string
): Promise<TJoinedUser> => {
  invariant(name, {
    code: 'BAD_REQUEST',
    message: 'Display name is required'
  });

  const [user] = await db
    .insert(users)
    .values({
      name,
      supabaseId: supabaseUserId,
      publicId: randomUUIDv7(),
      createdAt: Date.now()
    })
    .returning();

  publishUser(user!.id, 'create');

  const registeredUser = await getUserBySupabaseId(supabaseUserId);

  if (!registeredUser) {
    throw new Error('User registration failed');
  }

  if (inviteCode) {
    enqueueActivityLog({
      type: ActivityLogType.USED_INVITE,
      userId: registeredUser.id,
      details: { code: inviteCode },
      ip
    });
  }

  return registeredUser;
};

export { registerUser };
