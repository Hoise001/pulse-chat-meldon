import { resetApp } from '@/features/app/actions';
import { resetDialogs } from '@/features/dialogs/actions';
import { resetDmsState } from '@/features/dms/actions';
import { resetFriendsState } from '@/features/friends/actions';
import { resetServerScreens } from '@/features/server-screens/actions';
import {
  resetServerState,
  setConnected,
  setDisconnectInfo
} from '@/features/server/actions';
import { store } from '@/features/store';
import { getAccessToken, supabase } from '@/lib/supabase';
import { connectionManager } from '@/lib/connection-manager';
import { startReconnecting, stopReconnecting, isCurrentlyReconnecting } from '@/lib/reconnect';
import { DisconnectCode, type AppRouter, type TConnectionParams } from '@pulse/shared';
import { createTRPCProxyClient, createWSClient, wsLink } from '@trpc/client';

let wsClient: ReturnType<typeof createWSClient> | null = null;
let trpc: ReturnType<typeof createTRPCProxyClient<AppRouter>> | null = null;
let lastHomeTrpc: ReturnType<typeof createTRPCProxyClient<AppRouter>> | null =
  null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatInFlight = false;
/** Set to true when the client intentionally closes the connection (sign-out). */
let intentionalClose = false;
/**
 * Called on every WebSocket auto-reconnect to re-run handshake + joinServer.
 * Registered by server/actions.ts after the initial connect so the auth
 * sequence is replayed on the same (reconnected) WS client without creating
 * a new one.
 */
let reauthCallback: (() => Promise<void>) | null = null;
/** Prevents concurrent reauthCallback executions if onOpen fires multiple times. */
let reauthInProgress = false;

export const setReauthCallback = (cb: () => Promise<void>) => {
  reauthCallback = cb;
};

const HEARTBEAT_MS = 25_000;

const stopHeartbeat = () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  heartbeatInFlight = false;
};

const startHeartbeat = () => {
  stopHeartbeat();

  heartbeatTimer = setInterval(() => {
    if (!trpc || heartbeatInFlight) return;

    heartbeatInFlight = true;

    trpc.others.handshake
      .query()
      .catch(() => {
        // Ignore heartbeat failures; reconnect/onClose flow handles recovery.
      })
      .finally(() => {
        heartbeatInFlight = false;
      });
  }, HEARTBEAT_MS);
};

/** Whether a disconnect code means the user cannot reconnect. */
const isNonRecoverable = (code: number) =>
  code === DisconnectCode.BANNED;

const initializeTRPC = (host: string) => {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';

  wsClient = createWSClient({
    url: `${protocol}://${host}`,
    onOpen: () => {
      stopHeartbeat();

      const wasReconnecting = isCurrentlyReconnecting();

      // Cancel the manual reconnect timer IMMEDIATELY — before any awaits.
      // If we leave it running, reconnect.ts fires while reauthCallback is
      // in flight and calls connectToTRPC(), creating a second wsClient and a
      // second server context. The two contexts then race and the handshake
      // hash from one is validated against the other → FORBIDDEN.
      if (wasReconnecting) stopReconnecting();

      if (wasReconnecting && reauthCallback) {
        if (reauthInProgress) {
          // A previous onOpen already started re-auth; this is a duplicate
          // rapid-fire open event. Close this socket so onClose reschedules.
          console.warn('[trpc/ws] re-auth already in progress, closing duplicate socket');
          wsClient?.close();
          return;
        }

        reauthInProgress = true;
        reauthCallback()
          .then(() => {
            setConnected(true);
            setDisconnectInfo(undefined);
            startHeartbeat();
          })
          .catch((err) => {
            console.warn('[trpc/ws] re-auth failed after auto-reconnect, closing to retry', err);
            // Close the socket; onClose will call startReconnecting() again
            // and schedule the next attempt with backoff.
            wsClient?.close();
          })
          .finally(() => {
            reauthInProgress = false;
          });
      } else {
        // Initial connection — connect() in server/actions handles auth directly.
        setConnected(true);
        setDisconnectInfo(undefined);
        startHeartbeat();
      }
    },
    // @ts-expect-error - the onclose type is not correct in trpc
    onClose: (cause: CloseEvent) => {
      const code = cause.code;
        console.warn('[trpc/ws] socket closed', {
          code,
          reason: cause.reason,
          wasClean: cause.wasClean
        });

      // If we intentionally closed (user sign-out / cleanup), do nothing —
      // cleanup() already handles the full teardown
      if (intentionalClose) {
        wsClient = null;
        trpc = null;
        lastHomeTrpc = null;
        stopHeartbeat();
        intentionalClose = false;
        return;
      }

      if (isNonRecoverable(code)) {
        wsClient = null;
        trpc = null;
        lastHomeTrpc = null;
        stopHeartbeat();
        // Kicked/Banned — full teardown, show the Disconnected screen
        fullTeardown();
        setDisconnectInfo({
          code: cause.code,
          reason: cause.reason,
          wasClean: cause.wasClean,
          time: new Date()
        });
        return;
      }

      // Already in a reconnection loop (intermediate close from failed attempt)
      if (isCurrentlyReconnecting()) return;

      // Recoverable disconnect — keep UI visible, start reconnecting
      startReconnecting(code);
    },
    connectionParams: async (): Promise<TConnectionParams> => {
      return {
        accessToken: (await getAccessToken()) || ''
      };
    }
  });

  trpc = createTRPCProxyClient<AppRouter>({
    links: [wsLink({ client: wsClient })]
  });
  lastHomeTrpc = trpc;
  startHeartbeat();

  return trpc;
};

const connectToTRPC = (host: string) => {
  // Always create a fresh connection (old one is dead after disconnect)
  return initializeTRPC(host);
};

const getTRPCClient = () => {
  // When viewing a federated server, route calls to the remote instance
  const state = store.getState();
  const instanceDomain = state.app.activeInstanceDomain;

  if (instanceDomain) {
    const remote = connectionManager.getRemoteTRPCClient(instanceDomain);
    if (remote) return remote;
  }

  if (!trpc) {
    if (lastHomeTrpc) {
      return lastHomeTrpc;
    }

    throw new Error('TRPC client is not initialized');
  }

  return trpc;
};

// Always returns the home instance client — use for friends, DMs, auth, and
// other operations that must never target a remote federated instance
const getHomeTRPCClient = () => {
  if (!trpc) {
    if (lastHomeTrpc) {
      return lastHomeTrpc;
    }

    throw new Error('TRPC client is not initialized');
  }

  return trpc;
};

/** Reset all Redux state (used on intentional disconnect or non-recoverable kick/ban). */
const fullTeardown = () => {
  resetServerScreens();
  resetServerState();
  resetDialogs();
  resetFriendsState();
  resetDmsState();
  resetApp();
};

const cleanup = (signOut = false) => {
  stopReconnecting();
  intentionalClose = true;
  reauthInProgress = false;

  if (wsClient) {
    wsClient.close();
    wsClient = null;
  }

  trpc = null;
  lastHomeTrpc = null;
  stopHeartbeat();
  fullTeardown();

  if (signOut) {
    supabase.auth.signOut({ scope: 'local' });
  }
};

export { cleanup, connectToTRPC, getHomeTRPCClient, getTRPCClient, type AppRouter };
