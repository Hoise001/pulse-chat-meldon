import { useCurrentVoiceChannelId } from '@/features/server/channels/hooks';
import { playSound } from '@/features/server/sounds/actions';
import { useSoundpadStream } from './hooks/use-soundpad-stream';
import { SoundType } from '@/features/server/types';
import { logVoice } from '@/helpers/browser-logger';
import { getResWidthHeight } from '@/helpers/get-res-with-height';
import { getTRPCClient } from '@/lib/trpc';
import { StreamKind } from '@pulse/shared';
import { Device } from 'mediasoup-client';
import type { RtpCapabilities } from 'mediasoup-client/types';
import {
  createContext,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useDevices } from '../devices-provider/hooks/use-devices';
import type { TDeviceSettings } from '@/types';
import { FloatingPinnedCard } from './floating-pinned-card';
import { useLocalStreams } from './hooks/use-local-streams';
import { useRemoteStreams } from './hooks/use-remote-streams';
import {
  useTransportStats,
  type TransportStatsData
} from './hooks/use-transport-stats';
import { useTransports } from './hooks/use-transports';
import { useVoiceControls } from './hooks/use-voice-controls';
import { useVoiceEvents } from './hooks/use-voice-events';
import { VolumeControlProvider } from './volume-control-context';
import { ownVoiceStateSelector } from '@/features/server/voice/selectors';
import { useSelector } from 'react-redux';

type AudioVideoRefs = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  screenShareRef: React.RefObject<HTMLVideoElement | null>;
  screenShareAudioRef: React.RefObject<HTMLAudioElement | null>;
  externalAudioRef: React.RefObject<HTMLAudioElement | null>;
  externalVideoRef: React.RefObject<HTMLVideoElement | null>;
};

export type { AudioVideoRefs };

enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  FAILED = 'failed'
}

export type TVoiceProvider = {
  setLocalAudioStream: (stream: MediaStream | undefined) => void;
  loading: boolean;
  connectionStatus: ConnectionStatus;
  transportStats: TransportStatsData;
  sharingSystemAudio: boolean;
  playSoundpadAudio: (file: string, serverId?: number) => Promise<void>;
  realOutputSinkId: string | undefined;
  audioVideoRefsMap: Map<number, AudioVideoRefs>;
  getOrCreateRefs: (remoteId: number) => AudioVideoRefs;
  init: (
    routerRtpCapabilities: RtpCapabilities,
    channelId: number
  ) => Promise<void>;
} & Pick<
  ReturnType<typeof useLocalStreams>,
  'localAudioStream' | 'localVideoStream' | 'localScreenShareStream'
> &
  Pick<
    ReturnType<typeof useRemoteStreams>,
    'remoteUserStreams' | 'externalStreams'
  > &
  ReturnType<typeof useVoiceControls>;

const VoiceProviderContext = createContext<TVoiceProvider>({
  loading: false,
  connectionStatus: ConnectionStatus.DISCONNECTED,
  playSoundpadAudio: async () => {},
  transportStats: {
    producer: null,
    consumer: null,
    totalBytesReceived: 0,
    totalBytesSent: 0,
    isMonitoring: false,
    currentBitrateReceived: 0,
    currentBitrateSent: 0,
    averageBitrateReceived: 0,
    averageBitrateSent: 0
  },
  audioVideoRefsMap: new Map(),
  getOrCreateRefs: () => ({
    videoRef: { current: null },
    audioRef: { current: null },
    screenShareRef: { current: null },
    screenShareAudioRef: { current: null },
    externalAudioRef: { current: null },
    externalVideoRef: { current: null }
  }),
  init: () => Promise.resolve(),
  toggleMic: () => Promise.resolve(),
  toggleSound: () => Promise.resolve(),
  toggleWebcam: () => Promise.resolve(),
  toggleScreenShare: () => Promise.resolve(),
  ownVoiceState: {
    micMuted: false,
    soundMuted: false,
    webcamEnabled: false,
    sharingScreen: false
  },
  sharingSystemAudio: false,
  realOutputSinkId: undefined,
  localAudioStream: undefined,
  localVideoStream: undefined,
  localScreenShareStream: undefined,

  remoteUserStreams: {},
  externalStreams: {}
});

type TVoiceProviderProps = {
  children: React.ReactNode;
};

const VoiceProvider = memo(({ children }: TVoiceProviderProps) => {
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    ConnectionStatus.DISCONNECTED
  );
  const [sharingSystemAudio, setSharingSystemAudio] = useState(false);
  const [realOutputSinkId, setRealOutputSinkId] = useState<string | undefined>(undefined);
  const routerRtpCapabilities = useRef<RtpCapabilities | null>(null);
  const deviceRef = useRef<InstanceType<typeof Device> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const micMutedRef = useRef(false);
  const audioVideoRefsMap = useRef<Map<number, AudioVideoRefs>>(new Map());
  const { devices } = useDevices();
  const ownVoiceStateForRef = useSelector(ownVoiceStateSelector);

  // Keep micMutedRef in sync with Redux so startMicStream can read the
  // correct mute state without being in its dependency array.
  useEffect(() => {
    micMutedRef.current = ownVoiceStateForRef.micMuted;
  }, [ownVoiceStateForRef.micMuted]);

  const getOrCreateRefs = useCallback((remoteId: number): AudioVideoRefs => {
    if (!audioVideoRefsMap.current.has(remoteId)) {
      audioVideoRefsMap.current.set(remoteId, {
        videoRef: { current: null },
        audioRef: { current: null },
        screenShareRef: { current: null },
        screenShareAudioRef: { current: null },
        externalAudioRef: { current: null },
        externalVideoRef: { current: null }
      });
    }

    return audioVideoRefsMap.current.get(remoteId)!;
  }, []);

  const {
    addExternalStreamTrack,
    removeExternalStreamTrack,
    removeExternalStream,
    clearExternalStreams,
    addRemoteUserStream,
    removeRemoteUserStream,
    clearRemoteUserStreamsForUser,
    clearRemoteUserStreams,
    externalStreams,
    remoteUserStreams
  } = useRemoteStreams();

  const {
    localAudioProducer,
    localVideoProducer,
    localAudioStream,
    localVideoStream,
    localScreenShareStream,
    localScreenShareProducer,
    localScreenShareAudioProducer,
    setLocalAudioStream,
    setLocalVideoStream,
    setLocalScreenShare,
    clearLocalStreams
  } = useLocalStreams();
  const { playSoundpadAudio } = useSoundpadStream(
    audioContextRef,
    destinationRef
  );
  const {
    producerTransport,
    consumerTransport,
    createProducerTransport,
    createConsumerTransport,
    consume,
    consumeExistingProducers,
    cleanupTransports
  } = useTransports({
    addExternalStreamTrack,
    removeExternalStreamTrack,
    addRemoteUserStream,
    removeRemoteUserStream
  });

  const {
    stats: transportStats,
    startMonitoring,
    stopMonitoring,
    resetStats
  } = useTransportStats();

const startMicStream = useCallback(async () => {
    try {
      logVoice('Starting microphone stream with Audio Graph');

      // 1. Создаем контекст и точку назначения один раз
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
        destinationRef.current = audioContextRef.current.createMediaStreamDestination();
      }

      const ctx = audioContextRef.current;
      const dest = destinationRef.current!;

      // 2. Получаем реальный поток микрофона
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: devices.microphoneId ? { exact: devices.microphoneId } : undefined,
          autoGainControl: devices.autoGainControl,
          echoCancellation: devices.echoCancellation,
          noiseSuppression: devices.noiseSuppression,
          sampleRate: 48000,
          channelCount: 2
        },
        video: false
      });

      // 3. Подключаем физический микрофон к микшеру (сбрасывая старый вход при hot-swap)
      if (micSourceRef.current) micSourceRef.current.disconnect();
      micSourceRef.current = ctx.createMediaStreamSource(stream);
      // Create gain node once; it persists across device hot-swaps and
      // mute/unmute cycles — the producer track never needs replacing for mute.
      if (!micGainRef.current) {
        micGainRef.current = ctx.createGain();
        // Honour the mute state that was set before joining the channel.
        micGainRef.current.gain.value = micMutedRef.current ? 0 : 1;
        micGainRef.current.connect(dest);
      }
      micSourceRef.current.connect(micGainRef.current);

      setLocalAudioStream(stream);

      // 4. Берем стабильный трек из ВЫХОДА микшера
      const mixedTrack = dest.stream.getAudioTracks()[0];

      // 5. Работа с продюсером Mediasoup
      if (localAudioProducer.current) {
        // Если уже в эфире — просто меняем трек на mixedTrack (для Hot-swap)
        await localAudioProducer.current.replaceTrack({ track: mixedTrack });
      } else {
        // Если первый запуск — создаем продюсер
        localAudioProducer.current = await producerTransport.current?.produce({
          track: mixedTrack,
          appData: { kind: StreamKind.AUDIO }
        });

        // Слушатель закрытия (как в твоем оригинале)
        localAudioProducer.current?.on('@close', async () => {
          const trpc = getTRPCClient();
          try {
            await trpc.voice.closeProducer.mutate({ kind: StreamKind.AUDIO });
          } catch (error) {
            logVoice('Error closing audio producer', { error });
          }
        });
      }

      // Слушатель физического отключения микрофона
      stream.getAudioTracks()[0].onended = () => {
        logVoice('Physical mic track ended');
        // Не закрываем продюсер сразу, чтобы не ломать микшер
      };

    } catch (error) {
      logVoice('Error starting microphone stream', { error });
    }
  }, [
    producerTransport,
    setLocalAudioStream,
    localAudioProducer,
    devices.microphoneId,
    devices.autoGainControl,
    devices.echoCancellation,
    devices.noiseSuppression
  ]);

  const setMicGain = useCallback((gain: number) => {
    if (!micGainRef.current || !audioContextRef.current) return;
    micGainRef.current.gain.setValueAtTime(gain, audioContextRef.current.currentTime);
  }, []);

  const startWebcamStream = useCallback(async () => {
    try {
      logVoice('Starting webcam stream');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId: { ideal: devices?.webcamId },
          frameRate: devices.webcamFramerate,
          ...getResWidthHeight(devices?.webcamResolution)
        }
      });

      logVoice('Webcam stream obtained', { stream });

      setLocalVideoStream(stream);

      const videoTrack = stream.getVideoTracks()[0];

      if (videoTrack) {
        logVoice('Obtained video track', { videoTrack });

        localVideoProducer.current = await producerTransport.current?.produce({
          track: videoTrack,
          appData: { kind: StreamKind.VIDEO }
        });

        logVoice('Webcam video producer created', {
          producer: localVideoProducer.current
        });

        localVideoProducer.current?.on('@close', async () => {
          logVoice('Video producer closed');

          const trpc = getTRPCClient();

          try {
            await trpc.voice.closeProducer.mutate({
              kind: StreamKind.VIDEO
            });
          } catch (error) {
            logVoice('Error closing video producer', { error });
          }
        });

        videoTrack.onended = () => {
          logVoice('Video track ended, cleaning up webcam');

          localVideoStream?.getVideoTracks().forEach((track) => {
            track.stop();
          });
          localVideoProducer.current?.close();

          setLocalVideoStream(undefined);
        };
      } else {
        throw new Error('Failed to obtain video track from webcam');
      }
    } catch (error) {
      logVoice('Error starting webcam stream', { error });
      throw error;
    }
  }, [
    setLocalVideoStream,
    localVideoProducer,
    producerTransport,
    localVideoStream,
    devices.webcamId,
    devices.webcamFramerate,
    devices.webcamResolution
  ]);

  const stopWebcamStream = useCallback(() => {
    logVoice('Stopping webcam stream');

    localVideoStream?.getVideoTracks().forEach((track) => {
      logVoice('Stopping video track', { track });

      track.stop();
      localVideoStream.removeTrack(track);
    });

    localVideoProducer.current?.close();
    localVideoProducer.current = undefined;

    setLocalVideoStream(undefined);
  }, [localVideoStream, setLocalVideoStream, localVideoProducer]);

  const stopScreenShareStream = useCallback(async () => {
    logVoice('Stopping screen share stream');

    localScreenShareStream?.getTracks().forEach((track) => {
      logVoice('Stopping screen share track', { track });

      track.stop();
      localScreenShareStream.removeTrack(track);
    });

    localScreenShareProducer.current?.close();
    localScreenShareProducer.current = undefined;

    localScreenShareAudioProducer.current?.close();
    localScreenShareAudioProducer.current = undefined;

    // Stop macOS system audio capture if active
    window.pulseDesktop?.audioCapture?.stop();

    // Restore the microphone to original settings (echo cancellation was
    // forced ON during system audio capture to prevent acoustic bleed)
    if (sharingSystemAudio && localAudioProducer.current && !localAudioProducer.current.closed) {
      try {
        logVoice('macOS: Restoring mic to original settings');
        const newMicStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: devices.microphoneId
              ? { exact: devices.microphoneId }
              : undefined,
            autoGainControl: devices.autoGainControl,
            echoCancellation: devices.echoCancellation,
            noiseSuppression: devices.noiseSuppression,
            sampleRate: 48000,
            channelCount: 2
          },
          video: false
        });

        const newMicTrack = newMicStream.getAudioTracks()[0];
        if (newMicTrack) {
          await localAudioProducer.current.replaceTrack({ track: newMicTrack });
          localAudioStream?.getAudioTracks().forEach((t) => t.stop());
          setLocalAudioStream(newMicStream);
          logVoice('macOS: Mic restored to original settings');
        }
      } catch (err) {
        logVoice('macOS: Failed to restore mic settings', { error: err });
      }
    }

    setLocalScreenShare(undefined);
    setSharingSystemAudio(false);
    setRealOutputSinkId(undefined);
  }, [localScreenShareStream, setLocalScreenShare, localScreenShareProducer, localScreenShareAudioProducer, sharingSystemAudio, localAudioProducer, localAudioStream, setLocalAudioStream, devices.microphoneId, devices.autoGainControl, devices.echoCancellation, devices.noiseSuppression]);

  const startScreenShareStream = useCallback(async () => {
    try {
      logVoice('Starting screen share stream');

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          ...getResWidthHeight(devices?.screenResolution),
          frameRate: devices?.screenFramerate
        },
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: true,
          channelCount: 2,
          sampleRate: 48000
        },
        // Prevent sharing the app's own tab (major source of audio echo)
        selfBrowserSurface: 'exclude',
        preferCurrentTab: false
      } as DisplayMediaStreamOptions);

      logVoice('Screen share stream obtained', { stream });
      setLocalScreenShare(stream);

      const videoTrack = stream.getVideoTracks()[0];

      if (videoTrack) {
        // Detect if sharing screen/window (system audio) vs tab (isolated audio)
        const displaySurface = videoTrack.getSettings().displaySurface;
        const hasAudio = stream.getAudioTracks().length > 0;
        const isSystemAudio = hasAudio && displaySurface !== 'browser';

        logVoice('Screen share surface type', { displaySurface, hasAudio, isSystemAudio });
        setSharingSystemAudio(isSystemAudio);

        // Set BEFORE produce() so the browser initialises its encoder with
        // the right profile. 'motion' = framerate-optimised; if set after
        // produce() the encoder has already locked in its configuration.
        try { (videoTrack as any).contentHint = 'motion'; } catch { /* no-op */ }

        const maxBitrateBps = (devices.screenVideoBitrate ?? 10000) * 1000;
        // Start GCC close to the target bitrate so the ramp-up phase doesn't
        // cause visible stutter at the beginning of every share session.
        const startBitrateKbps = Math.round((devices.screenVideoBitrate ?? 10000) * 0.7);

        // Prefer AV1 for screen sharing: it achieves the same quality at ~40%
        // lower bitrate than H264 which leaves more headroom for the encoder to
        // keep frame rate stable. Fall back to H264 then VP8 for older browsers.
        const preferredMimeTypes = ['video/av1', 'video/h264', 'video/vp8'];
        const deviceCodecs = deviceRef.current?.rtpCapabilities.codecs ?? [];
        const screenCodec = preferredMimeTypes
          .map(mime => deviceCodecs.find(c => c.mimeType.toLowerCase() === mime))
          .find(Boolean);
        logVoice('Screen share codec selected', { codec: screenCodec?.mimeType ?? 'default' });

        localScreenShareProducer.current =
          await producerTransport.current?.produce({
            track: videoTrack,
            appData: { kind: StreamKind.SCREEN },
            ...(screenCodec ? { codec: screenCodec } : {}),
            encodings: [{
              maxBitrate: maxBitrateBps,
              maxFramerate: devices.screenFramerate,
              // L1T1: single spatial + temporal layer. No temporal scalability
              // means the encoder never halves/quarters the frame rate under
              // load — every encoded frame is delivered.
              scalabilityMode: 'L1T1',
              // Screen share should win the transport scheduler over audio.
              priority: 'high',
              networkPriority: 'high'
            }],
            // codecOptions only apply to H264/VP8; harmless but ignored for AV1
            codecOptions: {
              videoGoogleStartBitrate: startBitrateKbps
            }
          });

        // Tell WebRTC to drop resolution rather than framerate when congested.
        // Default ('balanced') drops FPS which feels like stutter; this keeps
        // the frame rate stable and briefly softens the picture instead.
        try {
          const sender = (localScreenShareProducer.current as any)?._rtpSender as RTCRtpSender | undefined;
          if (sender) {
            const params = sender.getParameters();
            params.encodings?.forEach((enc) => {
              (enc as any).degradationPreference = 'maintain-framerate';
            });
            await sender.setParameters(params);
          }
        } catch { /* browser may not support degradationPreference — not critical */ }

        localScreenShareProducer.current?.on('@close', async () => {
          logVoice('Screen share producer closed');

          const trpc = getTRPCClient();

          try {
            await trpc.voice.closeProducer.mutate({
              kind: StreamKind.SCREEN
            });
          } catch (error) {
            logVoice('Error closing screen share producer', { error });
          }
        });

        let audioTrack = stream.getAudioTracks()[0];

        // macOS Electron: use the virtual audio device for system audio capture.
        // Always prefer our HAL plugin over whatever getDisplayMedia returned,
        // because the system picker's audio track (from ScreenCaptureKit) may be
        // silent without the "Screen & System Audio Recording" permission, while
        // our virtual device only needs microphone permission.
        if (window.pulseDesktop?.audioCapture) {
          try {
            const available = await window.pulseDesktop.audioCapture.isAvailable();
            if (available) {
              logVoice('macOS: Starting system audio capture via virtual device');

              // Remove any audio track from getDisplayMedia — we'll replace it
              // with our virtual device capture which is more reliable
              if (audioTrack) {
                logVoice('macOS: Removing system picker audio track in favor of virtual device');
                audioTrack.stop();
                stream.removeTrack(audioTrack);
                audioTrack = undefined as unknown as MediaStreamTrack;
              }

              const captureResult = await window.pulseDesktop.audioCapture.start();

              if (captureResult) {
                // Find the Pulse Audio virtual input device
                const mediaDevices = await navigator.mediaDevices.enumerateDevices();

                logVoice('macOS: Available audio input devices', {
                  devices: mediaDevices
                    .filter((d) => d.kind === 'audioinput')
                    .map((d) => ({ id: d.deviceId, label: d.label }))
                });

                const pulseInput = mediaDevices.find(
                  (d) => d.kind === 'audioinput' && d.label.includes('Pulse Audio')
                );

                if (pulseInput) {
                  logVoice('macOS: Capturing from Pulse Audio device', { deviceId: pulseInput.deviceId });
                  const audioStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                      deviceId: { exact: pulseInput.deviceId },
                      autoGainControl: false,
                      echoCancellation: false,
                      noiseSuppression: false,
                      channelCount: 2,
                      sampleRate: 48000
                    }
                  });

                  audioTrack = audioStream.getAudioTracks()[0];
                  if (audioTrack) {
                    stream.addTrack(audioTrack);
                    setSharingSystemAudio(true);

                    // Find the real output device by name so we can route voice
                    // chat audio directly to it (bypassing the aggregate device).
                    // This prevents remote users' voices from being re-captured.
                    const realOutput = mediaDevices.find(
                      (d) => d.kind === 'audiooutput' && d.label.includes(captureResult.realOutputDeviceName)
                    );
                    if (realOutput) {
                      logVoice('macOS: Routing voice to real output', { deviceId: realOutput.deviceId, label: realOutput.label });
                      setRealOutputSinkId(realOutput.deviceId);
                    }

                    // Re-acquire the microphone with echo cancellation + noise
                    // suppression forced ON. The aggregate device routes system
                    // audio to the real speakers, and the built-in mic picks it
                    // up acoustically. Without this, the remote user hears the
                    // system audio bleeding through the mic stream.
                    if (localAudioProducer.current && !localAudioProducer.current.closed) {
                      try {
                        // Find the real microphone (exclude the Pulse Audio virtual device)
                        const realMic = mediaDevices.find(
                          (d) => d.kind === 'audioinput' &&
                            !d.label.includes('Pulse Audio') &&
                            (devices.microphoneId ? d.deviceId === devices.microphoneId : true)
                        );

                        if (realMic) {
                          logVoice('macOS: Re-acquiring mic with echo cancellation', { deviceId: realMic.deviceId, label: realMic.label });
                          const newMicStream = await navigator.mediaDevices.getUserMedia({
                            audio: {
                              deviceId: { exact: realMic.deviceId },
                              autoGainControl: true,
                              echoCancellation: true,
                              noiseSuppression: true,
                              sampleRate: 48000,
                              channelCount: 2
                            },
                            video: false
                          });

                          const newMicTrack = newMicStream.getAudioTracks()[0];
                          if (newMicTrack) {
                            await localAudioProducer.current.replaceTrack({ track: newMicTrack });
                            // Stop old tracks and update stream
                            localAudioStream?.getAudioTracks().forEach((t) => t.stop());
                            setLocalAudioStream(newMicStream);
                            logVoice('macOS: Mic re-acquired with echo cancellation enabled');
                          }
                        }
                      } catch (micErr) {
                        logVoice('macOS: Failed to re-acquire mic with echo cancellation', { error: micErr });
                      }
                    }
                  }
                } else {
                  logVoice('macOS: Pulse Audio input device not found, available inputs listed above');
                  window.pulseDesktop.audioCapture.stop();
                }
              }
            } else {
              logVoice('macOS: Audio driver not available, using system audio track if present');
            }
          } catch (err) {
            logVoice('macOS: System audio capture failed', { error: err });
            window.pulseDesktop?.audioCapture?.stop();
          }
        }

        if (audioTrack) {
          logVoice('Obtained screen share audio track', { audioTrack });

          const audioBitrate = (devices.screenAudioBitrate ?? 128) * 1000;

          localScreenShareAudioProducer.current =
            await producerTransport.current?.produce({
              track: audioTrack,
              appData: { kind: StreamKind.SCREEN_AUDIO },
              encodings: [{ maxBitrate: audioBitrate, dtx: false }],
              codecOptions: {
                opusStereo: true,
                opusDtx: false,
                opusFec: true,
                opusMaxPlaybackRate: 48000
              }
            });

          localScreenShareAudioProducer.current?.on('@close', async () => {
            logVoice('Screen share audio producer closed');

            const trpc = getTRPCClient();

            try {
              await trpc.voice.closeProducer.mutate({
                kind: StreamKind.SCREEN_AUDIO
              });
            } catch (error) {
              logVoice('Error closing screen share audio producer', { error });
            }
          });
        }

        videoTrack.onended = () => {
          logVoice('Screen share track ended, cleaning up screen share');

          localScreenShareStream?.getTracks().forEach((track) => {
            track.stop();
          });
          localScreenShareProducer.current?.close();
          localScreenShareAudioProducer.current?.close();

          // Stop macOS system audio capture if active
          window.pulseDesktop?.audioCapture?.stop();

          setLocalScreenShare(undefined);
          setRealOutputSinkId(undefined);
        };

        return videoTrack;
      } else {
        throw new Error('No video track obtained for screen share');
      }
    } catch (error) {
      logVoice('Error starting screen share stream', { error });
      throw error;
    }
  }, [
    setLocalScreenShare,
    localScreenShareProducer,
    localScreenShareAudioProducer,
    producerTransport,
    localScreenShareStream,
    localAudioProducer,
    localAudioStream,
    setLocalAudioStream,
    devices.screenResolution,
    devices.screenFramerate,
    devices.screenVideoBitrate,
    devices.screenAudioBitrate,
    devices.microphoneId
  ]);

  // Hot-swap microphone track on the existing producer when device settings change
  const reapplyMicSettings = useCallback(async () => {
    if (!localAudioProducer.current || localAudioProducer.current.closed) return;
    logVoice('Reapplying mic settings mid-call');
    await startMicStream();
  }, [startMicStream, localAudioProducer]);

  // Hot-swap webcam track on the existing producer when device settings change
  const reapplyWebcamSettings = useCallback(async (webcamEnabled: boolean) => {
    if (!webcamEnabled) return;
    if (!localVideoProducer.current || localVideoProducer.current.closed) return;

    try {
      logVoice('Reapplying webcam settings mid-call');

      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId: { ideal: devices.webcamId },
          frameRate: devices.webcamFramerate,
          ...getResWidthHeight(devices.webcamResolution)
        }
      });

      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) return;

      // Stop old tracks
      localVideoStream?.getVideoTracks().forEach((t) => t.stop());

      await localVideoProducer.current!.replaceTrack({ track: newTrack });
      setLocalVideoStream(newStream);
      logVoice('Webcam settings reapplied successfully');
    } catch (error) {
      logVoice('Error reapplying webcam settings', { error });
    }
  }, [
    localVideoProducer,
    localVideoStream,
    setLocalVideoStream,
    devices.webcamId,
    devices.webcamFramerate,
    devices.webcamResolution
  ]);

  const cleanup = useCallback(() => {
    logVoice('Running voice provider cleanup');

    // Fully tear down the Web Audio graph so startMicStream always rebuilds
    // it fresh on on rejoin. Without this the AudioContext may be suspended
    // by the browser between sessions and no audio flows on the second join.
    if (micSourceRef.current) {
      try { micSourceRef.current.disconnect(); } catch { /* no-op */ }
      micSourceRef.current = null;
    }
    if (micGainRef.current) {
      try { micGainRef.current.disconnect(); } catch { /* no-op */ }
      micGainRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch { /* no-op */ }
      audioContextRef.current = null;
    }
    destinationRef.current = null;

    stopMonitoring();
    resetStats();
    clearLocalStreams();
    clearRemoteUserStreams();
    clearExternalStreams();
    cleanupTransports();

    setConnectionStatus(ConnectionStatus.DISCONNECTED);
  }, [
    stopMonitoring,
    resetStats,
    clearLocalStreams,
    clearRemoteUserStreams,
    clearExternalStreams,
    cleanupTransports
  ]);

  const init = useCallback(
    async (
      incomingRouterRtpCapabilities: RtpCapabilities,
      channelId: number
    ) => {
      logVoice('Initializing voice provider', {
        incomingRouterRtpCapabilities,
        channelId
      });

      cleanup();

      try {
        setLoading(true);
        setConnectionStatus(ConnectionStatus.CONNECTING);

        routerRtpCapabilities.current = incomingRouterRtpCapabilities;

        const device = new Device();

        await device.load({
          routerRtpCapabilities: incomingRouterRtpCapabilities
        });

        deviceRef.current = device;

        await createProducerTransport(device);
        await createConsumerTransport(device);
        await consumeExistingProducers(incomingRouterRtpCapabilities);
        await startMicStream();

        startMonitoring(producerTransport.current, consumerTransport.current);
        setConnectionStatus(ConnectionStatus.CONNECTED);
        setLoading(false);
        playSound(SoundType.OWN_USER_JOINED_VOICE_CHANNEL);
      } catch (error) {
        logVoice('Error initializing voice provider', { error });

        setConnectionStatus(ConnectionStatus.FAILED);
        setLoading(false);

        throw error;
      }
    },
    [
      cleanup,
      createProducerTransport,
      createConsumerTransport,
      consumeExistingProducers,
      startMicStream,
      startMonitoring,
      producerTransport,
      consumerTransport
    ]
  );

  const {
    toggleMic,
    toggleSound,
    toggleWebcam,
    toggleScreenShare,
    ownVoiceState
  } = useVoiceControls({
    setMicGain,
    startWebcamStream,
    stopWebcamStream,
    startScreenShareStream,
    stopScreenShareStream
  });

  useVoiceEvents({
    consume,
    removeRemoteUserStream,
    removeExternalStreamTrack,
    removeExternalStream,
    clearRemoteUserStreamsForUser,
    rtpCapabilities: routerRtpCapabilities.current!
  });

  useEffect(() => {
    return () => {
      logVoice('Voice provider unmounting, cleaning up resources');
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clean up streams when leaving voice (channelId -> undefined)
  const currentVoiceChannelId = useCurrentVoiceChannelId();
  const prevChannelIdRef = useRef(currentVoiceChannelId);

  useEffect(() => {
    if (prevChannelIdRef.current && !currentVoiceChannelId) {
      logVoice('Voice channel left, cleaning up streams');
      cleanup();
    }
    prevChannelIdRef.current = currentVoiceChannelId;
  }, [currentVoiceChannelId, cleanup]);

  // Live-apply device setting changes while in a call
  const prevDevicesRef = useRef<TDeviceSettings | null>(null);

  useEffect(() => {
    if (connectionStatus !== ConnectionStatus.CONNECTED) {
      prevDevicesRef.current = null;
      return;
    }

    // Skip first run after connecting — devices were already used during init
    if (!prevDevicesRef.current) {
      prevDevicesRef.current = devices;
      return;
    }

    const prev = prevDevicesRef.current;
    prevDevicesRef.current = devices;

    const micChanged =
      prev.microphoneId !== devices.microphoneId ||
      prev.echoCancellation !== devices.echoCancellation ||
      prev.noiseSuppression !== devices.noiseSuppression ||
      prev.autoGainControl !== devices.autoGainControl;

    const webcamChanged =
      prev.webcamId !== devices.webcamId ||
      prev.webcamFramerate !== devices.webcamFramerate ||
      prev.webcamResolution !== devices.webcamResolution;

    if (micChanged) {
      reapplyMicSettings();
    }
    if (webcamChanged) {
      reapplyWebcamSettings(ownVoiceState.webcamEnabled);
    }
  }, [devices, connectionStatus, reapplyMicSettings, reapplyWebcamSettings, ownVoiceState.webcamEnabled]);

  const contextValue = useMemo<TVoiceProvider>(
    () => ({
      loading,
      connectionStatus,
      transportStats,
      playSoundpadAudio,
      sharingSystemAudio,
      realOutputSinkId,
      audioVideoRefsMap: audioVideoRefsMap.current,
      getOrCreateRefs,
      init,

      toggleMic,
      toggleSound,
      toggleWebcam,
      toggleScreenShare,
      ownVoiceState,

      localAudioStream,
      setLocalAudioStream,
      localVideoStream,
      localScreenShareStream,

      remoteUserStreams,
      externalStreams
    }),
    [
      loading,
      connectionStatus,
      transportStats,
      sharingSystemAudio,
      realOutputSinkId,
      getOrCreateRefs,
      init,

      toggleMic,
      toggleSound,
      toggleWebcam,
      playSoundpadAudio,
      toggleScreenShare,
      ownVoiceState,

      localAudioStream,
      localVideoStream,
      localScreenShareStream,
      remoteUserStreams,
      externalStreams
    ]
  );

  return (
    <VoiceProviderContext.Provider value={contextValue}>
      <VolumeControlProvider>
        <div className="relative">
          <FloatingPinnedCard
            remoteUserStreams={remoteUserStreams}
            externalStreams={externalStreams}
            localScreenShareStream={localScreenShareStream}
            localVideoStream={localVideoStream}
          />
          {children}
        </div>
      </VolumeControlProvider>
    </VoiceProviderContext.Provider>
  );
});

export { VoiceProvider, VoiceProviderContext };
