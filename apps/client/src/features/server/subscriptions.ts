import { subscribeToDms } from '@/features/dms/subscriptions';
import { subscribeToFriends } from '@/features/friends/subscriptions';
import { getTRPCClient } from '@/lib/trpc';
import type { TPublicServerSettings } from '../../../../../packages/shared/src/types';
import type { TServerSummary } from '../../../../../packages/shared/src/tables';
import { appSliceActions } from '../app/slice';
import { store } from '../store';
import { setPublicServerSettings } from './actions';
import { subscribeToCategories } from './categories/subscriptions';
import { subscribeToChannels } from './channels/subscriptions';
import { subscribeToEmojis } from './emojis/subscriptions';
import { subscribeToMessages } from './messages/subscriptions';
import { subscribeToPlugins } from './plugins/subscriptions';
import { subscribeToRoles } from './roles/subscriptions';
import { removeUser } from './users/actions';
import { subscribeToUsers } from './users/subscriptions';
import { subscribeToVoice } from './voice/subscriptions';

const subscribeToServer = () => {
  const trpc = getTRPCClient();

  const onSettingsUpdateSub = trpc.others.onServerSettingsUpdate.subscribe(
    undefined,
    {
      onData: async (settings: TPublicServerSettings) => {
        setPublicServerSettings(settings);
        const { fetchServerInfo, fetchJoinedServers } = await import('../app/actions');
        const { setInfo } = await import('./actions');
        const info = await fetchServerInfo();
        if (info) setInfo(info);
        // Always force a full joinedServers refresh to guarantee UI sync
        await fetchJoinedServers();
      },
      onError: (err: unknown) =>
        console.error('onSettingsUpdate subscription error:', err)
    }
  );

  const onMemberJoinSub = trpc.servers.onMemberJoin.subscribe(undefined, {
    onData: ({
      server
    }: {
      serverId: number;
      userId: number;
      server: TServerSummary;
    }) => {
      store.dispatch(appSliceActions.addJoinedServer(server));
    },
    onError: (err: unknown) =>
      console.error('onServerMemberJoin subscription error:', err)
  });

  const onMemberLeaveSub = trpc.servers.onMemberLeave.subscribe(undefined, {
    onData: ({ serverId, userId }: { serverId: number; userId: number }) => {
      const state = store.getState();
      const ownUserId = state.server.ownUserId;
      if (userId === ownUserId) {
        // This client is being removed from the server (kicked or left)
        store.dispatch(appSliceActions.removeJoinedServer(serverId));
      } else {
        // Another member left/was kicked — remove them from the local member list
        removeUser(userId);
      }
    },
    onError: (err: unknown) =>
      console.error('onServerMemberLeave subscription error:', err)
  });

  const onUnreadCountUpdateSub =
    trpc.servers.onUnreadCountUpdate.subscribe(undefined, {
      onData: (data: { serverId: number; count: number; mentionCount: number }) => {
        store.dispatch(
          appSliceActions.setServerUnreadCount({
            serverId: data.serverId,
            count: data.count,
            mentionCount: data.mentionCount
          })
        );
      },
      onError: (err: unknown) =>
        console.error('onUnreadCountUpdate subscription error:', err)
    });

  return () => {
    onSettingsUpdateSub.unsubscribe();
    onMemberJoinSub.unsubscribe();
    onMemberLeaveSub.unsubscribe();
    onUnreadCountUpdateSub.unsubscribe();
  };
};

const initSubscriptions = () => {
  // Voice subscriptions are intentionally NOT included here.
  // They persist across server switches and are managed separately
  // in actions.ts to prevent audio disruption during server navigation.
  const subscriptors = [
    subscribeToChannels,
    subscribeToServer,
    subscribeToEmojis,
    subscribeToRoles,
    subscribeToUsers,
    subscribeToMessages,
    subscribeToCategories,
    subscribeToPlugins,
    subscribeToFriends,
    subscribeToDms
  ];

  const unsubscribes = subscriptors.map((subscriptor) => subscriptor());

  return () => {
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  };
};

export { initSubscriptions, subscribeToVoice };
