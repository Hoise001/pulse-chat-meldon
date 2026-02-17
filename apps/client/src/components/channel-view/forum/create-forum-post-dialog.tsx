import { Button } from '@/components/ui/button';
import { getTRPCClient } from '@/lib/trpc';
import { setActiveThreadId } from '@/features/server/channels/actions';
import { Plus, X } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type TCreateForumPostDialogProps = {
  channelId: number;
  onClose: () => void;
};

type TTag = {
  id: number;
  name: string;
  color: string;
};

const CreateForumPostDialog = memo(
  ({ channelId, onClose }: TCreateForumPostDialogProps) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tags, setTags] = useState<TTag[]>([]);
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
      const fetchTags = async () => {
        const trpc = getTRPCClient();

        try {
          const result = await trpc.threads.getForumTags.query({ channelId });
          setTags(result);
        } catch {
          // ignore
        }
      };

      fetchTags();
    }, [channelId]);

    const toggleTag = useCallback((tagId: number) => {
      setSelectedTagIds((prev) =>
        prev.includes(tagId)
          ? prev.filter((id) => id !== tagId)
          : [...prev, tagId]
      );
    }, []);

    const onSubmit = useCallback(async () => {
      if (!title.trim() || !content.trim() || submitting) return;

      setSubmitting(true);

      const trpc = getTRPCClient();

      try {
        const result = await trpc.threads.createForumPost.mutate({
          channelId,
          title: title.trim(),
          content: content.trim(),
          tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined
        });

        setActiveThreadId(result.threadId);
        toast.success('Post created');
        onClose();
      } catch {
        toast.error('Failed to create post');
      } finally {
        setSubmitting(false);
      }
    }, [title, content, channelId, selectedTagIds, submitting, onClose]);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-popover border border-border rounded-lg shadow-xl w-full max-w-lg mx-4">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <h2 className="text-sm font-semibold">New Post</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Post title"
                className="w-full px-3 py-2 text-sm bg-muted/30 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30"
                maxLength={200}
                autoFocus
              />
            </div>

            <div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your post..."
                className="w-full px-3 py-2 text-sm bg-muted/30 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30 min-h-[120px] resize-y"
                rows={5}
              />
            </div>

            {tags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className="px-2 py-1 rounded text-xs font-medium border transition-colors"
                    style={{
                      backgroundColor: selectedTagIds.includes(tag.id)
                        ? `${tag.color}30`
                        : 'transparent',
                      borderColor: selectedTagIds.includes(tag.id)
                        ? tag.color
                        : 'var(--border)',
                      color: selectedTagIds.includes(tag.id)
                        ? tag.color
                        : 'inherit'
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 px-4 py-3 border-t border-border/50">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onSubmit}
              disabled={!title.trim() || !content.trim() || submitting}
            >
              <Plus className="w-4 h-4 mr-1" />
              Create Post
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

export { CreateForumPostDialog };
