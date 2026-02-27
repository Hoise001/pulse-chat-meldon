import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog';
import { UserControl } from '@/components/left-sidebar';
import { VoiceControl } from '@/components/left-sidebar/voice-control';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { ServerStrip } from '@/components/server-strip';
import { useActiveView } from '@/features/app/hooks';
import { VoiceProvider } from '@/components/voice-provider';
import { PersistentAudioStreams } from '@/components/voice-provider/persistent-audio-streams';
import { useAutoAway } from '@/hooks/use-auto-away';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useTabNotifications } from '@/hooks/use-tab-notifications';
import { cn } from '@/lib/utils';
import { memo } from 'react';
import { DiscoverView } from '../discover-view';
import { FoundryView } from '../foundry-view';
import { HomeView } from '../home-view';
import { ServerView } from '../server-view';

const MainViewInner = memo(() => {
  const activeView = useActiveView();
  useTabNotifications();
  useAutoAway();

  const { shortcutsDialogOpen, setShortcutsDialogOpen } = useKeyboardShortcuts();

  const renderView = () => {
    switch (activeView) {
      case 'home':
        return <HomeView />;
      case 'discover':
        return <DiscoverView />;
      case 'server':
        return <ServerView />;
      case 'foundry':
        return null; // rendered persistently below
    }
  };

  return (
    <>
      <PersistentAudioStreams />
      <div className="flex h-dvh bg-background text-foreground">
        <div className="hidden md:flex">
          <ServerStrip />
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Non-foundry views are conditionally rendered */}
          <div
            className={cn(
              'flex flex-1 flex-col overflow-hidden',
              activeView === 'foundry' && 'hidden'
            )}
          >
            {activeView !== 'foundry' && renderView()}
            <MobileBottomNav />
          </div>
          {/* FoundryView is always mounted so the iframe never reloads */}
          <div
            className={cn(
              'flex-1 overflow-hidden',
              activeView === 'foundry' ? 'flex' : 'hidden'
            )}
          >
            <FoundryView />
          </div>
        </div>
        {activeView !== 'discover' && activeView !== 'foundry' && (
          <div className="hidden md:block fixed bottom-6 left-2 z-20 w-[calc(72px+15rem-0.5rem)] rounded-xl bg-card border border-border overflow-hidden shadow-lg">
            <VoiceControl />
            <UserControl />
          </div>
        )}
      </div>
      <KeyboardShortcutsDialog
        open={shortcutsDialogOpen}
        onOpenChange={setShortcutsDialogOpen}
      />
    </>
  );
});

const MainView = memo(() => {
  return (
    <VoiceProvider>
      <MainViewInner />
    </VoiceProvider>
  );
});

export { MainView };
