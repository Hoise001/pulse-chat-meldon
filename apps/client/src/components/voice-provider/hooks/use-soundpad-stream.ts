import { useCallback, useRef } from 'react';

/**
 * Plays soundpad audio into VoiceProvider's existing AudioContext destination
 * node so remote users hear it. The mediasoup producer track is NEVER changed
 * — the audio simply flows through the same mixed destination the producer
 * already uses. This keeps mute/unmute (GainNode) fully operational at all
 * times.
 */
export const useSoundpadStream = (
  audioContextRef: React.RefObject<AudioContext | null>,
  destinationRef: React.RefObject<MediaStreamAudioDestinationNode | null>
) => {
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const playSoundpadAudio = useCallback(async (file: string) => {
    const ctx = audioContextRef.current;
    const destination = destinationRef.current;
    if (!ctx || !destination || ctx.state === 'closed') return;

    // Cancel any currently-playing soundpad sound
    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); } catch { /* no-op */ }
      try { activeSourceRef.current.disconnect(); } catch { /* no-op */ }
      activeSourceRef.current = null;
    }

    const res = await fetch(`/public/soundpad/${file}`);
    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    // Connect directly into the shared destination — same node the producer
    // track reads from. No replaceTrack needed.
    source.connect(destination);
    activeSourceRef.current = source;
    source.start();
    source.onended = () => {
      try { source.disconnect(); } catch { /* no-op */ }
      if (activeSourceRef.current === source) {
        activeSourceRef.current = null;
      }
    };
  }, [audioContextRef, destinationRef]);

  return { playSoundpadAudio };
};
