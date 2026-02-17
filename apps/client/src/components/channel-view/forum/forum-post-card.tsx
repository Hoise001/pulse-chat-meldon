import { useUserById } from '@/features/server/users/hooks';
import { cn } from '@/lib/utils';
import { Archive, MessageSquare } from 'lucide-react';
import { memo, useMemo } from 'react';

type TForumPostCardProps = {
  thread: {
    id: number;
    name: string;
    messageCount: number;
    lastMessageAt: number | null;
    archived: boolean;
    createdAt: number;
    creatorId?: number;
    tags?: { id: number; name: string; color: string }[];
  };
  onClick: (threadId: number) => void;
};

const ForumPostCard = memo(({ thread, onClick }: TForumPostCardProps) => {
  const creator = useUserById(thread.creatorId ?? 0);

  const timeAgo = useMemo(() => {
    const ts = thread.lastMessageAt ?? thread.createdAt;
    const diff = Date.now() - ts;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);

    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }, [thread.lastMessageAt, thread.createdAt]);

  return (
    <button
      type="button"
      onClick={() => onClick(thread.id)}
      className={cn(
        'w-full text-left p-3 rounded-lg border border-border/50 hover:border-border hover:bg-accent/30 transition-all cursor-pointer',
        thread.archived && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium truncate">{thread.name}</h3>
            {thread.archived && (
              <Archive className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            {creator && <span>{creator.name}</span>}
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {thread.messageCount}
            </span>
            <span>{timeAgo}</span>
          </div>
          {thread.tags && thread.tags.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {thread.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
});

export { ForumPostCard };
