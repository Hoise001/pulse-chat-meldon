import { useCurrentVoiceChannelId } from '@/features/server/channels/hooks';
import { playSound } from '@/features/server/sounds/actions';
import { SoundType } from '@/features/server/types';
import { updateOwnVoiceState } from '@/features/server/voice/actions';
import { useOwnVoiceState } from '@/features/server/voice/hooks';
import { getTrpcError } from '@/helpers/parse-trpc-errors';
import { getTRPCClient } from '@/lib/trpc';
import { useCallback } from 'react';
import { toast } from 'sonner';

type TUseVoiceControlsParams = {
  /** Sets the microphone gain (0 = muted, 1 = unmuted). */
  setMicGain: (gain: number) => void;

  startWebcamStream: () => Promise<void>;
  stopWebcamStream: () => void;

  startScreenShareStream: () => Promise<MediaStreamTrack>;
  stopScreenShareStream: () => void | Promise<void>;
};

const useVoiceControls = ({
  setMicGain,
  startWebcamStream,
  stopWebcamStream,
  startScreenShareStream,
  stopScreenShareStream
}: TUseVoiceControlsParams) => {
  const ownVoiceState = useOwnVoiceState();
  const currentVoiceChannelId = useCurrentVoiceChannelId();

  const toggleMic = useCallback(async () => {
    const newState = !ownVoiceState.micMuted;
    const trpc = getTRPCClient();

    updateOwnVoiceState({ micMuted: newState });
    playSound(
      newState ? SoundType.OWN_USER_MUTED_MIC : SoundType.OWN_USER_UNMUTED_MIC
    );

    if (!currentVoiceChannelId) return;

    // Control mute purely via the AudioContext GainNode — the mediasoup producer
    // track is never replaced. gain=0 sends silence over RTP; gain=1 restores
    // mic audio. This avoids all replaceTrack(null/track) state issues across
    // different browsers and mediasoup-client versions.
    setMicGain(newState ? 0 : 1);

    try {
      await trpc.voice.updateState.mutate({
        micMuted: newState
      });
    } catch (error) {
      toast.error(getTrpcError(error, 'Failed to update microphone state'));
    }
  }, [
    ownVoiceState.micMuted,
    currentVoiceChannelId,
    setMicGain
  ]);

  const toggleSound = useCallback(async () => {
    const newState = !ownVoiceState.soundMuted;
    const trpc = getTRPCClient();

    updateOwnVoiceState({ soundMuted: newState });
    playSound(
      newState
        ? SoundType.OWN_USER_MUTED_SOUND
        : SoundType.OWN_USER_UNMUTED_SOUND
    );

    if (!currentVoiceChannelId) return;

    try {
      await trpc.voice.updateState.mutate({
        soundMuted: newState
      });
    } catch (error) {
      toast.error(getTrpcError(error, 'Failed to update sound state'));
    }
  }, [ownVoiceState.soundMuted, currentVoiceChannelId]);

  const toggleWebcam = useCallback(async () => {
    if (!currentVoiceChannelId) return;

    const newState = !ownVoiceState.webcamEnabled;
    const trpc = getTRPCClient();

    updateOwnVoiceState({ webcamEnabled: newState });

    playSound(
      newState
        ? SoundType.OWN_USER_STARTED_WEBCAM
        : SoundType.OWN_USER_STOPPED_WEBCAM
    );

    try {
      await trpc.voice.updateState.mutate({
        webcamEnabled: newState
      });

      if (newState) {
        await startWebcamStream();
      } else {
        stopWebcamStream();
      }
    } catch (error) {
      toast.error(getTrpcError(error, 'Failed to update webcam state'));
    }
  }, [
    ownVoiceState.webcamEnabled,
    currentVoiceChannelId,
    startWebcamStream,
    stopWebcamStream
  ]);

  const toggleScreenShare = useCallback(async () => {
    const newState = !ownVoiceState.sharingScreen;
    const trpc = getTRPCClient();

    if (newState) {
      // macOS Electron: prompt to install audio driver if not yet active
      if (window.pulseDesktop?.platform === 'darwin' && window.pulseDesktop?.audioDriver) {
        try {
          const status = await window.pulseDesktop.audioDriver.getStatus();
          if (status.supported && !status.active) {
            const shouldInstall = confirm(
              'To share system audio on macOS, Pulse needs to install a virtual audio driver.\n\n' +
              'This requires administrator privileges. You can also share without audio.\n\n' +
              'Install the audio driver now?'
            );
            if (shouldInstall) {
              const result = await window.pulseDesktop.audioDriver.install();
              if (result.success) {
                toast.success('Audio driver installed successfully');
              } else if (result.error && !result.error.includes('cancelled')) {
                toast.error(`Driver install failed: ${result.error}`);
              }
            }
          }
        } catch {
          // Non-critical — continue with screen share regardless
        }
      }

      // getDisplayMedia must be called synchronously from the user gesture,
      // before any awaits, or the browser will reject it.
      try {
        const video = await startScreenShareStream();

        updateOwnVoiceState({ sharingScreen: true });
        playSound(SoundType.OWN_USER_STARTED_SCREENSHARE);

        await trpc.voice.updateState.mutate({
          sharingScreen: true
        });

        // handle native screen share end
        video.onended = async () => {
          await stopScreenShareStream();
          updateOwnVoiceState({ sharingScreen: false });

          await trpc.voice.updateState.mutate({
            sharingScreen: false
          });
        };
      } catch (error) {
        toast.error(getTrpcError(error, 'Failed to start screen share'));
      }
    } else {
      updateOwnVoiceState({ sharingScreen: false });
      playSound(SoundType.OWN_USER_STOPPED_SCREENSHARE);

      try {
        await stopScreenShareStream();
        await trpc.voice.updateState.mutate({
          sharingScreen: false
        });
      } catch (error) {
        toast.error(getTrpcError(error, 'Failed to update screen share state'));
      }
    }
  }, [
    ownVoiceState.sharingScreen,
    startScreenShareStream,
    stopScreenShareStream
  ]);

  return {
    toggleMic,
    toggleSound,
    toggleWebcam,
    toggleScreenShare,
    ownVoiceState
  };
};

export { useVoiceControls };
