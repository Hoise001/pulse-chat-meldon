import { setActiveView, switchServer } from '@/features/app/actions';
import {
  useActiveServerId,
  useActiveView,
  useJoinedServers
} from '@/features/app/hooks';
import { useFriendRequests } from '@/features/friends/hooks';
import { getHandshakeHash } from '@/features/server/actions';
import { openServerScreen } from '@/features/server-screens/actions';
import { useHasAnyUnread } from '@/features/server/hooks';
import { getFileUrl } from '@/helpers/get-file-url';
import { cn } from '@/lib/utils';
import { Compass, Home, Server, User } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { ServerScreen } from '../server-screens/screens';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '../ui/sheet';

const MobileBottomNav = memo(() => {
  const activeView = useActiveView();
  const friendRequests = useFriendRequests();
  const pendingCount = friendRequests.length;
  const joinedServers = useJoinedServers();
  const activeServerId = useActiveServerId();
  const hasAnyUnread = useHasAnyUnread();
  const [showServerSheet, setShowServerSheet] = useState(false);

  const handleHomeClick = useCallback(() => {
    setActiveView('home');
  }, []);

  const handleDiscoverClick = useCallback(() => {
    setActiveView('discover');
  }, []);

  const handleServersClick = useCallback(() => {
    setShowServerSheet(true);
  }, []);

  const handleServerSelect = useCallback((serverId: number) => {
    const hash = getHandshakeHash();
    if (hash) {
      switchServer(serverId, hash);
    }
    setShowServerSheet(false);
  }, []);

  const handleUserClick = useCallback(() => {
    openServerScreen(ServerScreen.USER_SETTINGS);
  }, []);

  return (
    <>
      <nav className="flex md:hidden h-14 w-full border-t border-border bg-sidebar items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        <button
          onClick={handleHomeClick}
          className={cn(
            'flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors',
            activeView === 'home'
              ? 'text-white'
              : 'text-muted-foreground'
          )}
        >
          <div className="relative">
            <Home className="h-5 w-5" />
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground">
                {pendingCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Home</span>
        </button>

        <button
          onClick={handleDiscoverClick}
          className={cn(
            'flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors',
            activeView === 'discover'
              ? 'text-white'
              : 'text-muted-foreground'
          )}
        >
          <Compass className="h-5 w-5" />
          <span className="text-[10px]">Discover</span>
        </button>

        <button
          onClick={handleServersClick}
          className={cn(
            'flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors',
            activeView === 'server'
              ? 'text-white'
              : 'text-muted-foreground'
          )}
        >
          <Server className="h-5 w-5" />
          <span className="text-[10px]">Servers</span>
        </button>

        <button
          onClick={handleUserClick}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors text-muted-foreground"
        >
          <User className="h-5 w-5" />
          <span className="text-[10px]">You</span>
        </button>
      </nav>

      <Sheet
        open={showServerSheet}
        onOpenChange={setShowServerSheet}
      >
        <SheetContent
          side="bottom"
          close={() => setShowServerSheet(false)}
          className="max-h-[60vh]"
        >
          <SheetHeader>
            <SheetTitle>Servers</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-4 gap-3 p-4 overflow-y-auto">
            {joinedServers.map((server) => {
              const isActive =
                activeView === 'server' && activeServerId === server.id;
              const firstLetter = server.name.charAt(0).toUpperCase();

              return (
                <button
                  key={server.id}
                  onClick={() => handleServerSelect(server.id)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200 overflow-hidden',
                      isActive
                        ? 'bg-primary text-primary-foreground rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background'
                        : 'bg-secondary text-muted-foreground'
                    )}
                  >
                    {server.logo ? (
                      <img
                        src={getFileUrl(server.logo.name)}
                        alt={server.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-lg font-semibold">
                        {firstLetter}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-foreground truncate max-w-[64px] text-center">
                    {server.name}
                  </span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
});

export { MobileBottomNav };
