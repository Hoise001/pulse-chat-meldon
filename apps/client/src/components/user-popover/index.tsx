import { setActiveView, setModViewOpen } from '@/features/app/actions';
import { useActiveInstanceDomain } from '@/features/app/hooks';
import { requestTextInput } from '@/features/dialogs/actions';
import { getOrCreateDmChannel, sendDmMessage } from '@/features/dms/actions';
import { useFriends } from '@/features/friends/hooks';
import {
  removeFriendAction,
  sendFriendRequest
} from '@/features/friends/actions';
import { useUserRoles } from '@/features/server/hooks';
import { useOwnUserId, useUserById } from '@/features/server/users/hooks';
import { getFileUrl } from '@/helpers/get-file-url';
import { getHomeTRPCClient, getTRPCClient } from '@/lib/trpc';
import { Permission, UserStatus } from '@pulse/shared';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Copy,
  Ellipsis,
  Globe,
  Pencil,
  Plus,
  ShieldCheck,
  StickyNote,
  UserCog,
  UserMinus,
  UserPlus,
  X
} from 'lucide-react';
import i18n from 'i18next';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Protect } from '../protect';
import { RoleBadge } from '../role-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { TiptapInput } from '../tiptap-input';
import { isHtmlEmpty } from '@/helpers/is-html-empty';
import { UserAvatar } from '../user-avatar';
import { UserStatusBadge } from '../user-status';

type TNote = {
  id: number;
  content: string;
  createdAt: number;
};

type TUserPopoverProps = {
  userId: number;
  children: React.ReactNode;
};

const UserPopover = memo(({ userId, children }: TUserPopoverProps) => {
  const { t } = useTranslation();
  const user = useUserById(userId);
  const roles = useUserRoles(userId);
  const ownUserId = useOwnUserId();
  const friends = useFriends();
  const activeInstanceDomain = useActiveInstanceDomain();
  const isOwnUser = !activeInstanceDomain && userId === ownUserId;

  const [notes, setNotes] = useState<TNote[]>([]);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [popoverMessage, setPopoverMessage] = useState('');

  const isFriend = useMemo(
    () => friends.some((f) => f.id === userId),
    [friends, userId]
  );

  const fetchNotes = useCallback(async () => {
    try {
      const trpc = getTRPCClient();
      const result = await trpc.notes.getAll.query({ targetUserId: userId });
      setNotes(result.notes);
      setNotesLoaded(true);
    } catch {
      // silently fail
    }
  }, [userId]);

  // Refetch notes when they change in another tab
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.targetUserId === userId && notesLoaded) {
        fetchNotes();
      }
    };
    window.addEventListener('notes-changed', handler);
    return () => window.removeEventListener('notes-changed', handler);
  }, [userId, notesLoaded, fetchNotes]);

  const handlePopoverOpen = useCallback(
    (open: boolean) => {
      if (open) {
        setNotesLoaded(false);
        fetchNotes();
      }
    },
    [fetchNotes]
  );

  const handleAddNote = useCallback(async () => {
    const text = await requestTextInput({
      title: t('userPopover.addNote'),
      message: t('userPopover.addNoteMessage', { name: user?.name ?? 'this user' }),
      confirmLabel: t('common.save'),
      cancelLabel: t('common.cancel')
    });

    if (text) {
      try {
        const trpc = getTRPCClient();
        await trpc.notes.add.mutate({ targetUserId: userId, content: text });
        toast.success(t('userPopover.toasts.noteSaved'));
        fetchNotes();
      } catch {
        toast.error(t('userPopover.toasts.failedSaveNote'));
      }
    }
  }, [userId, user, fetchNotes, t]);

  const handleDeleteNote = useCallback(
    async (noteId: number) => {
      try {
        const trpc = getTRPCClient();
        await trpc.notes.delete.mutate({ noteId });
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        toast.success(t('userPopover.toasts.noteDeleted'));
      } catch {
        toast.error(t('userPopover.toasts.failedDeleteNote'));
      }
    },
    [t]
  );

  const resolveLocalUserId = useCallback(async (): Promise<number> => {
    if (!activeInstanceDomain || !user) return userId;

    if (!user.publicId) {
      console.error('Cannot resolve federated user without publicId');
      return userId;
    }

    const trpc = getHomeTRPCClient();
    const result = await trpc.federation.ensureShadowUser.mutate({
      instanceDomain: activeInstanceDomain,
      remoteUserId: userId,
      username: user.name,
      remotePublicId: user.publicId
    });
    return result.localUserId;
  }, [activeInstanceDomain, userId, user]);

  const handleSendPopoverMessage = useCallback(async () => {
    if (isHtmlEmpty(popoverMessage)) return;
    try {
      const localId = await resolveLocalUserId();
      const channel = await getOrCreateDmChannel(localId);
      if (channel) {
        await sendDmMessage(channel.id, popoverMessage);
        setPopoverMessage('');
        setActiveView('home');
      }
    } catch {
      toast.error(t('userPopover.toasts.failedSendMessage'));
    }
  }, [resolveLocalUserId, popoverMessage, t]);

  const handleAddFriend = useCallback(async () => {
    try {
      const localId = await resolveLocalUserId();
      await sendFriendRequest(localId);
      toast.success(t('userPopover.toasts.friendRequestSent'));
    } catch {
      toast.error(t('userPopover.toasts.failedFriendRequest'));
    }
  }, [resolveLocalUserId, t]);

  const handleRemoveFriend = useCallback(async () => {
    try {
      const localId = await resolveLocalUserId();
      await removeFriendAction(localId);
      toast.success(t('userPopover.toasts.friendRemoved'));
    } catch {
      toast.error(t('userPopover.toasts.failedRemoveFriend'));
    }
  }, [resolveLocalUserId, t]);

  const handleEditNickname = useCallback(async () => {
    const text = await requestTextInput({
      title: t('userPopover.setNickname'),
      message: t('userPopover.setNicknameMessage'),
      confirmLabel: t('common.save'),
      cancelLabel: t('common.cancel'),
      defaultValue: user?.nickname ?? '',
      allowEmpty: true
    });

    if (text !== null && text !== undefined) {
      try {
        const trpc = getTRPCClient();
        const nickname = text.trim() || null;
        if (isOwnUser) {
          await trpc.users.setNickname.mutate({ nickname });
        } else {
          await trpc.users.setUserNickname.mutate({ userId, nickname });
        }
        toast.success(nickname ? t('userPopover.toasts.nicknameUpdated') : t('userPopover.toasts.nicknameCleared'));
      } catch {
        toast.error(t('userPopover.toasts.failedUpdateNickname'));
      }
    }
  }, [userId, user, isOwnUser, t]);

  if (!user) return <>{children}</>;

  return (
    <Popover onOpenChange={handlePopoverOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" side="right">
        {/* === Zone 1: Banner + Avatar + Action Buttons === */}
        <div className="relative">
          {user.banner ? (
            <div
              className="h-24 w-full rounded-t-md bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: `url(${getFileUrl(user.banner, activeInstanceDomain ?? undefined)})`
              }}
            />
          ) : (
            <div
              className="h-24 w-full rounded-t-md"
              style={{
                background: user.bannerColor || 'var(--primary)'
              }}
            />
          )}
          <div className="absolute left-4 top-16">
            <UserAvatar
              userId={user.id}
              className="h-16 w-16 border-4 border-card"
              showStatusBadge={false}
            />
          </div>

          {/* Action buttons on banner */}
          <div className="absolute right-2 top-2 flex items-center gap-1.5">
            {!isOwnUser && (
              <button
                type="button"
                className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                onClick={isFriend ? handleRemoveFriend : handleAddFriend}
                title={isFriend ? t('userPopover.removeFriend') : t('userPopover.addFriend')}
              >
                {isFriend ? (
                  <UserMinus className="h-4 w-4" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
              </button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                >
                  <Ellipsis className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {isOwnUser ? (
                  <DropdownMenuItem onClick={handleEditNickname}>
                    <Pencil className="h-4 w-4" />
                    Edit Nickname
                  </DropdownMenuItem>
                ) : (
                  <Protect permission={Permission.MANAGE_USERS}>
                    <DropdownMenuItem onClick={handleEditNickname}>
                      <Pencil className="h-4 w-4" />
                      Edit Nickname
                    </DropdownMenuItem>
                  </Protect>
                )}
                <DropdownMenuItem onClick={handleAddNote}>
                  <StickyNote className="h-4 w-4" />
                  Add Note
                </DropdownMenuItem>
                {user.publicId && (
                  <DropdownMenuItem
                    onClick={() => {
                      navigator.clipboard.writeText(user.publicId!);
                      toast.success('User ID copied');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    Copy User ID
                  </DropdownMenuItem>
                )}
                <Protect permission={Permission.MANAGE_USERS}>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setModViewOpen(true, user.id)}
                  >
                    <UserCog className="h-4 w-4" />
                    Moderation View
                  </DropdownMenuItem>
                </Protect>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* === Zone 2: Identity === */}
        <div className="px-4 pt-12 pb-2">
          <h3 className="text-lg font-bold text-foreground truncate">
            {user.nickname || user.name}
          </h3>
          {user.nickname && (
            <p className="text-sm text-muted-foreground">{user.name}</p>
          )}
          {user._identity && user._identity.includes('@') && (
            <div className="flex items-center gap-1 mt-0.5">
              <Globe className="h-3 w-3 text-blue-500" />
              <span className="text-xs text-blue-500">
                {t('userPopover.federatedFrom')}{' '}
                {user._identity.split('@').slice(1).join('@')}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-1.5">
            <UserStatusBadge
              status={user.status || UserStatus.OFFLINE}
              className="h-3 w-3"
            />
            <span className="text-xs text-muted-foreground capitalize">
              {i18n.t(`common.status.${user.status || UserStatus.OFFLINE}`)}
            </span>
          </div>
        </div>

        {/* === Zone 3: Details === */}
        <div className="px-4 py-3 space-y-3 border-t border-border max-h-48 overflow-y-auto">
          {user.banned && (
            <div className="flex items-center gap-1.5 text-red-500 bg-red-500/10 rounded-md px-2 py-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{t('userPopover.thisBanned')}</span>
            </div>
          )}

          {roles.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                {t('userPopover.roles')}
              </p>
              <div className="flex flex-wrap gap-1">
                {roles.map((role) => (
                  <RoleBadge key={role.id} role={role} />
                ))}
              </div>
            </div>
          )}

          {user.bio && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                {t('userPopover.aboutMe')}
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {user.bio}
              </p>
            </div>
          )}

          {notesLoaded && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('userPopover.notes')}
                </p>
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={handleAddNote}
                >
                  <Plus className="h-3 w-3" />
                  {t('userPopover.add')}
                </button>
              </div>
              {notes.length > 0 ? (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="group flex items-start gap-2 text-sm"
                    >
                      <p className="flex-1 text-foreground text-xs leading-relaxed break-words">
                        {note.content}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(note.createdAt), {
                            addSuffix: true
                          })}
                        </span>
                        <button
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  {t('userPopover.noNotesYet')}
                </p>
              )}
            </div>
          )}

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              {t('userPopover.memberSince')}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(user.createdAt), 'PP')}
            </p>
          </div>
        </div>

        {/* === Zone 4: Message Input === */}
        {!isOwnUser && (
          <div className="px-4 pb-4 pt-2 border-t border-border">
            <div className="flex items-center gap-2 rounded-md bg-muted/50 border border-border px-3 py-1.5 cursor-text"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                const pm = e.currentTarget.querySelector('.ProseMirror');
                if (pm instanceof HTMLElement) pm.focus();
              }}
            >
              <TiptapInput
                value={popoverMessage}
                placeholder={t('userPopover.messageAt', { name: user.name })}
                onChange={setPopoverMessage}
                onSubmit={handleSendPopoverMessage}
              />
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
});

UserPopover.displayName = 'UserPopover';

export { UserPopover };
