import { randomUUIDv7 } from 'bun';
import { publicProcedure } from '../../utils/trpc';

const handshakeRoute = publicProcedure.query(async ({ ctx }) => {
  // Only generate a new hash if this connection doesn't have one yet.
  // The heartbeat (client/trpc.ts) also calls this route every 25 s, but we
  // must NOT rotate the hash on those calls — the client never updates its
  // stored hash during heartbeats, so regenerating would cause the next
  // joinServer call to fail with FORBIDDEN.
  if (!ctx.handshakeHash) {
    ctx.handshakeHash = randomUUIDv7();
  }
  return { handshakeHash: ctx.handshakeHash };
});

export { handshakeRoute };
