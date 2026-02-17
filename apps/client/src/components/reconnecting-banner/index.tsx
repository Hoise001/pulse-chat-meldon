import { useIsReconnecting, useReconnectAttempt } from '@/features/server/hooks';
import { Loader2 } from 'lucide-react';
import { memo } from 'react';

const ReconnectingBanner = memo(() => {
  const isReconnecting = useIsReconnecting();
  const attempt = useReconnectAttempt();

  if (!isReconnecting) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-yellow-600 px-4 py-1.5 text-sm font-medium text-white shadow-md">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>
        Reconnecting{attempt > 1 ? ` (attempt ${attempt})` : ''}...
      </span>
    </div>
  );
});

export { ReconnectingBanner };
