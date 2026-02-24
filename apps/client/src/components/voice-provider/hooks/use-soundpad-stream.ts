import { useCallback, useRef } from 'react';
import type { AppData, Producer } from 'mediasoup-client/types';

export const useSoundpadStream = (
  localAudioStream: MediaStream | undefined,
  localAudioProducer: React.RefObject<Producer<AppData> | undefined>
) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const mixedDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const ensureContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext();
      mixedDestinationRef.current = audioContextRef.current.createMediaStreamDestination();
      micSourceRef.current = null;
    }
    const ctx = audioContextRef.current;
    const destination = mixedDestinationRef.current!;
    if (localAudioStream && !micSourceRef.current) {
      const micSource = ctx.createMediaStreamSource(localAudioStream);
      micSource.connect(destination);
      micSourceRef.current = micSource;
    }
    return { ctx, destination };
  }, [localAudioStream]);

  const playSoundpadAudio = useCallback(async (file: string) => {
    const producer = localAudioProducer.current;
    if (!producer || producer.closed) return;

    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
      mixedDestinationRef.current = null;
      micSourceRef.current = null;
    }

    const { ctx, destination } = ensureContext();
    const res = await fetch(`/public/soundpad/${file}`);
    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(destination);

    const mixedTrack = destination.stream.getAudioTracks()[0];
    if (mixedTrack) {
      await producer.replaceTrack({ track: mixedTrack });
      source.start();
      source.onended = async () => {
        try {
          const micTrack = localAudioStream?.getAudioTracks()[0];
          if (micTrack && micTrack.readyState === 'live') {
            await producer.replaceTrack({ track: micTrack });
          }
        } catch (e) {
          console.warn('Could not restore mic track:', e);
        }
      };
    }
  }, [ensureContext, localAudioProducer, localAudioStream]);

  return { playSoundpadAudio };
};
