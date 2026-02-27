import { SoundType } from '../types';

/**
 * The audio sink ID to route app sounds to during system audio capture.
 * Set to 'communications' on Windows loopback or a specific device ID on
 * macOS to keep notification/join/leave sounds off the default output device
 * (which is being loopback-captured) and prevent them feeding back into the
 * screen share audio stream.
 */
let activeSoundSinkId: string | undefined = undefined;

/**
 * Called by the VoiceProvider whenever the real output sink changes.
 * Pass `undefined` to reset back to the browser default.
 */
export const setActiveSoundSinkId = (id: string | undefined): void => {
  activeSoundSinkId = id;
};

/**
 * Mapping of Pulse-Chat events to your custom MP3 files.
 * Ensure these files are located in your /public/sounds/ folder.
 */
const SOUND_MAP: Record<SoundType, string> = {
  [SoundType.MESSAGE_RECEIVED]: '/sounds/message.mp3',
  [SoundType.MESSAGE_SENT]: '/sounds/message.mp3', // 
  [SoundType.OWN_USER_JOINED_VOICE_CHANNEL]: '/sounds/user_join.mp3',
  [SoundType.OWN_USER_LEFT_VOICE_CHANNEL]: '/sounds/voice_disconnected.mp3',
  [SoundType.OWN_USER_MUTED_MIC]: '/sounds/mute.mp3',
  [SoundType.OWN_USER_UNMUTED_MIC]: '/sounds/unmute.mp3',
  [SoundType.OWN_USER_MUTED_SOUND]: '/sounds/deafen.mp3',
  [SoundType.OWN_USER_UNMUTED_SOUND]: '/sounds/undeafen.mp3',
  [SoundType.OWN_USER_STARTED_WEBCAM]: '/sounds/stream_started.mp3',
  [SoundType.OWN_USER_STOPPED_WEBCAM]: '/sounds/stream_stopped.mp3',
  [SoundType.OWN_USER_STARTED_SCREENSHARE]: '/sounds/stream_started.mp3',
  [SoundType.OWN_USER_STOPPED_SCREENSHARE]: '/sounds/stream_stopped.mp3',
  [SoundType.REMOTE_USER_JOINED_VOICE_CHANNEL]: '/sounds/user_join.mp3',
  [SoundType.REMOTE_USER_LEFT_VOICE_CHANNEL]: '/sounds/user_leave.mp3',
};
const GLOBAL_VOLUME = 0.4;
/**
 * Main function to play application sounds.
 * Replaces the old Web Audio API oscillators with custom MP3s.
 */
export const playSound = (type: SoundType) => {
  const filePath = SOUND_MAP[type];
  if (!filePath) {
    return;
  }
  const audio = new Audio(filePath);
  audio.volume = GLOBAL_VOLUME;

  // During system audio capture / loopback, route sounds to the designated
  // device (e.g. 'communications' on Windows, real output on macOS) so they
  // don't end up on the default output being loopback-captured.
  const sinkId = activeSoundSinkId;
  if (sinkId && 'setSinkId' in audio) {
    (audio as unknown as { setSinkId(id: string): Promise<void> })
      .setSinkId(sinkId)
      .then(() => audio.play())
      .catch((err) => {
        // setSinkId failed (device gone?) — fall back to default
        audio.play().catch((e) => console.debug('Audio playback prevented:', e.message));
        console.debug('setSinkId failed for sound:', (err as Error).message);
      });
  } else {
    audio.play().catch((error) => {
      // This usually triggers if the user hasn't interacted with the UI yet
      console.debug("Audio playback prevented:", error.message);
    });
  }
};
/**
 * Plays a sound preview in the settings UI.
 */
export const playSoundForPreview = (soundType: SoundType) => {
  const filePath = SOUND_MAP[soundType];
  if (!filePath) return;
  const audio = new Audio(filePath);
  audio.volume = GLOBAL_VOLUME;
  audio.play().catch((error) => {
    console.debug("Preview playback prevented:", error.message);
  });
};
