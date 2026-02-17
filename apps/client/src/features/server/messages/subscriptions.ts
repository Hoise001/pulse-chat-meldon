import { getTRPCClient } from '@/lib/trpc';
import type { TJoinedMessage } from '@pulse/shared';
import {
  addMessages,
  addTypingUser,
  deleteMessage,
  updateMessage
} from './actions';

const subscribeToMessages = () => {
  const trpc = getTRPCClient();

  const onMessageSub = trpc.messages.onNew.subscribe(undefined, {
    onData: (message: TJoinedMessage) =>
      addMessages(message.channelId, [message], {}, true),
    onError: (err) => console.error('onMessage subscription error:', err)
  });

  const onMessageUpdateSub = trpc.messages.onUpdate.subscribe(undefined, {
    onData: (message: TJoinedMessage) =>
      updateMessage(message.channelId, message),
    onError: (err) => console.error('onMessageUpdate subscription error:', err)
  });

  const onMessageDeleteSub = trpc.messages.onDelete.subscribe(undefined, {
    onData: ({ messageId, channelId }) => deleteMessage(channelId, messageId),
    onError: (err) => console.error('onMessageDelete subscription error:', err)
  });

  const onMessageTypingSub = trpc.messages.onTyping.subscribe(undefined, {
    onData: ({ userId, channelId }) => {
      addTypingUser(channelId, userId);
    },
    onError: (err) => console.error('onMessageTyping subscription error:', err)
  });

  const onMessagePinSub = trpc.messages.onPin.subscribe(undefined, {
    onData: ({
      channelId
    }: {
      messageId: number;
      channelId: number;
      pinnedBy: number;
    }) => {
      window.dispatchEvent(
        new CustomEvent('pinned-messages-changed', { detail: { channelId } })
      );
    },
    onError: (err) => console.error('onMessagePin subscription error:', err)
  });

  const onMessageUnpinSub = trpc.messages.onUnpin.subscribe(undefined, {
    onData: ({
      channelId
    }: {
      messageId: number;
      channelId: number;
    }) => {
      window.dispatchEvent(
        new CustomEvent('pinned-messages-changed', { detail: { channelId } })
      );
    },
    onError: (err) => console.error('onMessageUnpin subscription error:', err)
  });

  return () => {
    onMessageSub.unsubscribe();
    onMessageUpdateSub.unsubscribe();
    onMessageDeleteSub.unsubscribe();
    onMessageTypingSub.unsubscribe();
    onMessagePinSub.unsubscribe();
    onMessageUnpinSub.unsubscribe();
  };
};

export { subscribeToMessages };
