import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { dmMessages } from '../../db/schema';
import { urlMetadataParser } from '../message-metadata/get-message-metadata';

export const processDmMessageMetadata = async (
  content: string,
  dmMessageId: number
) => {
  const metadata = await urlMetadataParser(content);

  if (!metadata || metadata.length === 0) return null;

  const [updatedMessage] = await db
    .update(dmMessages)
    .set({
      metadata,
      updatedAt: Date.now()
    })
    .where(eq(dmMessages.id, dmMessageId))
    .returning();

  return updatedMessage;
};
