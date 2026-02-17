import { ServerEvents } from '@pulse/shared';
import Queue from 'queue';
import { getDmChannelMemberIds, getDmMessage } from '../../db/queries/dms';
import { pubsub } from '../../utils/pubsub';
import { processDmMessageMetadata } from './get-dm-message-metadata';

const dmMessageMetadataQueue = new Queue({
  concurrency: 1,
  autostart: true,
  timeout: 3000
});

dmMessageMetadataQueue.autostart = true;

const enqueueProcessDmMetadata = (
  content: string,
  dmMessageId: number,
  dmChannelId: number
) => {
  dmMessageMetadataQueue.push(async (callback) => {
    const updated = await processDmMessageMetadata(content, dmMessageId);

    if (updated) {
      const joined = await getDmMessage(dmMessageId);

      if (joined) {
        const memberIds = await getDmChannelMemberIds(dmChannelId);

        for (const memberId of memberIds) {
          pubsub.publishFor(
            memberId,
            ServerEvents.DM_MESSAGE_UPDATE,
            joined
          );
        }
      }
    }

    callback?.();
  });
};

export { enqueueProcessDmMetadata, dmMessageMetadataQueue };
