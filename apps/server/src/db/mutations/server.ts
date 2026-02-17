import type { TSettings } from '@pulse/shared';
import { isNotNull } from 'drizzle-orm';
import { db } from '..';
import { settings } from '../schema';

const updateSettings = async (serverSettings: Partial<TSettings>) => {
  const [result] = await db
    .update(settings)
    .set(serverSettings)
    .where(isNotNull(settings.name))
    .returning();
  return result;
};

export { updateSettings };
