import { SoundType } from '../types';
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
  audio.play().catch((error) => {
    // This usually triggers if the user hasn't interacted with the UI yet
    console.debug("Audio playback prevented:", error.message);
  });
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
