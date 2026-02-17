import { setActiveThreadId } from '@/features/server/channels/actions';
import { useChannelById } from '@/features/server/channels/hooks';
import { MessageSquare } from 'lucide-react';
import { memo, useCallback } from 'react';

type TThreadIndicatorProps = {
  threadId: number;
};

const ThreadIndicator = memo(({ threadId }: TThreadIndicatorProps) => {
  const thread = useChannelById(threadId);

  const onClick = useCallback(() => {
    setActiveThreadId(threadId);
  }, [threadId]);

  if (!thread) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 mt-1 pl-1 cursor-pointer transition-colors"
    >
      <MessageSquare className="w-3 h-3" />
      <span className="font-medium">{thread.name}</span>
    </button>
  );
});

export { ThreadIndicator };
