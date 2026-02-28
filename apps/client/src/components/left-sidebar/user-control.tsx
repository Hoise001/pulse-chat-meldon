import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useAvailableDevices } from '@/components/devices-provider/hooks/use-available-devices';
import { useDevices } from '@/components/devices-provider/hooks/use-devices';
import { openServerScreen } from '@/features/server-screens/actions';
import { useCurrentVoiceChannelId } from '@/features/server/channels/hooks';
import { useChannelCan } from '@/features/server/hooks';
import { useOwnPublicUser } from '@/features/server/users/hooks';
import { useVoice } from '@/features/server/voice/hooks';
import { getDisplayName } from '@/helpers/get-display-name';
import { cn } from '@/lib/utils';
import { getTRPCClient } from '@/lib/trpc';
import { ChannelPermission, UserStatus } from '@pulse/shared';
import {
  ChevronUp,
  HeadphoneOff,
  Headphones,
  Mic,
  MicOff,
  Settings
} from 'lucide-react';
import { memo, useCallback } from 'react';
import { ServerScreen } from '../server-screens/screens';
import { Button } from '../ui/button';
import { UserAvatar } from '../user-avatar';
import { getStatusLabel, UserStatusBadge } from '../user-status';
import { UserPopover } from '../user-popover';

const statusOptions = [
  UserStatus.ONLINE,
  UserStatus.IDLE,
  UserStatus.DND,
  UserStatus.INVISIBLE
] as const;

const UserControl = memo(() => {
  const { t } = useTranslation();
  const ownPublicUser = useOwnPublicUser();
  const currentVoiceChannelId = useCurrentVoiceChannelId();
  const { ownVoiceState, toggleMic, toggleSound } = useVoice();
  const channelCan = useChannelCan(currentVoiceChannelId);
  const { inputDevices, playbackDevices } = useAvailableDevices();
  const { devices, saveDevices } = useDevices();

  const handleSettingsClick = useCallback(() => {
    openServerScreen(ServerScreen.USER_SETTINGS);
  }, []);

  const handleStatusChange = useCallback(async (status: (typeof statusOptions)[number]) => {
    const trpc = getTRPCClient();
    await trpc.users.setStatus.mutate({ status });
  }, []);

  const handleMicDeviceChange = useCallback(
    (deviceId: string) => {
      saveDevices({ ...devices, microphoneId: deviceId });
    },
    [devices, saveDevices]
  );

  const handlePlaybackDeviceChange = useCallback(
    (deviceId: string) => {
      saveDevices({ ...devices, playbackId: deviceId });
    },
    [devices, saveDevices]
  );

  const openVoiceSettings = useCallback(() => {
    openServerScreen(ServerScreen.USER_SETTINGS);
  }, []);

  if (!ownPublicUser) return null;

  const currentStatus = ownPublicUser.status || UserStatus.OFFLINE;

  return (
    <div className="flex items-center justify-between h-14 px-2 bg-muted/50">
      <div className="flex items-center space-x-2 min-w-0 flex-1">
        <UserPopover userId={ownPublicUser.id}>
          <div className="cursor-pointer">
            <div className="relative">
              <UserAvatar
                userId={ownPublicUser.id}
                className="h-8 w-8 flex-shrink-0"
                showUserPopover={false}
              />
              <div className="absolute -bottom-0.5 -right-0.5">
                <UserStatusBadge status={currentStatus} className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </UserPopover>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-medium text-foreground truncate">
            {getDisplayName(ownPublicUser)}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left cursor-pointer">
                {getStatusLabel(currentStatus)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {statusOptions.map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className="flex items-center gap-2"
                >
                  <UserStatusBadge status={status} className="h-3 w-3" />
                  <span>{getStatusLabel(status)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        {/* Mic button + device dropdown */}
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-7 rounded-r-none',
              ownVoiceState.micMuted
                ? 'text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
            onClick={toggleMic}
            title={
              ownVoiceState.micMuted
                ? t('voice.buttons.micUnmute')
                : t('voice.buttons.micMute')
            }
            disabled={!channelCan(ChannelPermission.SPEAK)}
          >
            {ownVoiceState.micMuted ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'h-8 w-4 flex items-center justify-center rounded-r-md transition-colors cursor-pointer',
                  ownVoiceState.micMuted
                    ? 'text-red-500/60 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20'
                    : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/50'
                )}
              >
                <ChevronUp className="h-2.5 w-2.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-64">
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                {t('voice.devices.inputDevice')}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={devices.microphoneId || 'default'}
                onValueChange={handleMicDeviceChange}
              >
                {inputDevices.map((device) => (
                  <DropdownMenuRadioItem
                    key={device?.deviceId || 'default'}
                    value={device?.deviceId || 'default'}
                  >
                    {device?.label.trim() || t('voice.devices.defaultMicrophone')}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={openVoiceSettings}>
                <Settings className="h-4 w-4" />
                {t('userControl.voiceSettings')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Headphone button + device dropdown */}
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-7 rounded-r-none',
              ownVoiceState.soundMuted
                ? 'text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
            onClick={toggleSound}
            title={
              ownVoiceState.soundMuted
                ? t('voice.buttons.undeafen')
                : t('voice.buttons.deafen')
            }
          >
            {ownVoiceState.soundMuted ? (
              <HeadphoneOff className="h-4 w-4" />
            ) : (
              <Headphones className="h-4 w-4" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'h-8 w-4 flex items-center justify-center rounded-r-md transition-colors cursor-pointer',
                  ownVoiceState.soundMuted
                    ? 'text-red-500/60 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20'
                    : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/50'
                )}
              >
                <ChevronUp className="h-2.5 w-2.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-64">
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                {t('voice.devices.outputDevice')}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={devices.playbackId || 'default'}
                onValueChange={handlePlaybackDeviceChange}
              >
                {playbackDevices.map((device) => (
                  <DropdownMenuRadioItem
                    key={device?.deviceId || 'default'}
                    value={device?.deviceId || 'default'}
                  >
                    {device?.label.trim() || t('voice.devices.defaultSpeaker')}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={openVoiceSettings}>
                <Settings className="h-4 w-4" />
                {t('voice.devices.voiceSettings')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"
          onClick={handleSettingsClick}
          title={t('userControl.userSettings')}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

export { UserControl };
