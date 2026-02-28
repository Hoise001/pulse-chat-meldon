import { setSelectedChannelId } from '@/features/server/channels/actions';
import { useCurrentVoiceChannelId } from '@/features/server/channels/hooks';
import { useOwnUserId } from '@/features/server/users/hooks';
import { useVoice } from '@/features/server/voice/hooks';
import { StreamKind } from '@pulse/shared';
import { MessageSquare, X } from 'lucide-react';
import { memo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

type TFullscreenStreamOverlayProps = {
  userId: number;
  onClose: () => void;
};

// ─── Electron path ────────────────────────────────────────────────────────────
// Opens a dedicated fullscreen BrowserWindow. The MediaStream is relayed via a
// local WebRTC loopback peer connection — the only way to share a live
// MediaStream between Electron renderer processes.

const ElectronFullscreenStream = memo(
  ({ userId, onClose }: TFullscreenStreamOverlayProps) => {
    const { remoteUserStreams, localScreenShareStream } = useVoice();
    const currentVoiceChannelId = useCurrentVoiceChannelId();
    const ownUserId = useOwnUserId();
    const pcRef = useRef<RTCPeerConnection | null>(null);

    const isOwnUser = userId === ownUserId;
    const screenShareStream = isOwnUser
      ? localScreenShareStream
      : remoteUserStreams[userId]?.[StreamKind.SCREEN];

    // Open the viewer window and set up the WebRTC source peer.
    useEffect(() => {
      if (!currentVoiceChannelId) return;
      const svApi = window.pulseDesktop?.streamViewer;
      if (!svApi) return;

      let active = true;

      const setup = async () => {
        await svApi.open(currentVoiceChannelId);
        if (!active) return;

        // Wait until the viewer's RTCPeerConnection is ready.
        await new Promise<void>((resolve) => {
          svApi.onViewerReady(resolve);
        });
        if (!active) return;

        const stream = isOwnUser
          ? localScreenShareStream
          : remoteUserStreams[userId]?.[StreamKind.SCREEN];

        if (!stream) {
          svApi.close();
          return;
        }

        const pc = new RTCPeerConnection({ iceServers: [] });
        pcRef.current = pc;

        // 'detail' hint tells the encoder to prioritise sharpness / lossless
        // reproduction over motion smoothness — ideal for screen share content.
        stream.getTracks().forEach((track: MediaStreamTrack) => {
          if (track.kind === 'video') {
            (track as MediaStreamTrack & { contentHint: string }).contentHint = 'detail';
          }
          pc.addTrack(track, stream);
        });

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            svApi.signalToViewer({ type: 'ice', candidate: e.candidate.toJSON() });
          }
        };

        // Apply high-bitrate encoding parameters once the connection is live.
        // setParameters() is only reliable after the transport is connected.
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') {
            pc.getSenders().forEach((sender) => {
              if (!sender.track) return;
              const params = sender.getParameters();
              if (!params.encodings?.length) params.encodings = [{}];
              params.encodings.forEach((enc) => {
                enc.maxBitrate = 50_000_000; // 50 Mbps ceiling
                enc.priority = 'high';
                enc.networkPriority = 'high';
              });
              sender.setParameters(params).catch(() => {});
            });
          }
        };

        svApi.onSignal(async (data: unknown) => {
          const msg = data as { type: string; sdp?: string; candidate?: RTCIceCandidateInit };
          try {
            if (msg.type === 'answer' && msg.sdp) {
              await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
            } else if (msg.type === 'ice' && msg.candidate) {
              await pc.addIceCandidate(msg.candidate);
            }
          } catch {
            // ICE failures are non-fatal in loopback
          }
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        svApi.signalToViewer({ type: 'offer', sdp: offer.sdp });
      };

      setup().catch(() => {});

      svApi.onViewerClosed(() => {
        if (active) onClose();
      });

      return () => {
        active = false;
        pcRef.current?.close();
        pcRef.current = null;
        svApi.offSignal();
        svApi.offViewerClosed();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentVoiceChannelId]);

    // If the source stream disappears (user stopped sharing), close the window.
    useEffect(() => {
      if (!screenShareStream && pcRef.current) {
        window.pulseDesktop?.streamViewer?.close();
        onClose();
      }
    }, [screenShareStream, onClose]);

    // No UI in the main window — the viewer BrowserWindow owns the full-screen UI.
    return null;
  }
);

// ─── Web / browser fallback ───────────────────────────────────────────────────
// Simple fullscreen portal rendered inside the same document. Stream is
// directly available (same renderer process) so no WebRTC relay is needed.

const WebFullscreenStream = memo(
  ({ userId, onClose }: TFullscreenStreamOverlayProps) => {
    const { t } = useTranslation();
    const videoRef = useRef<HTMLVideoElement>(null);
    const { remoteUserStreams, localScreenShareStream } = useVoice();
    const currentVoiceChannelId = useCurrentVoiceChannelId();
    const ownUserId = useOwnUserId();

    const isOwnUser = userId === ownUserId;
    const screenShareStream = isOwnUser
      ? localScreenShareStream
      : remoteUserStreams[userId]?.[StreamKind.SCREEN];

    useEffect(() => {
      if (!videoRef.current) return;
      videoRef.current.srcObject = screenShareStream ?? null;
    }, [screenShareStream]);

    const handleOpenChat = useCallback(() => {
      if (currentVoiceChannelId) {
        setSelectedChannelId(currentVoiceChannelId);
        window.dispatchEvent(new CustomEvent('open-voice-chat-sidebar'));
      }
      onClose();
    }, [currentVoiceChannelId, onClose]);

    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    return createPortal(
      <div className="fixed inset-0 z-[9000] bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-contain"
        />
        <div className="absolute bottom-6 right-6 flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenChat}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium backdrop-blur-sm transition-colors border border-white/10"
            title={t('voice.fullscreen.openChatTitle')}
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            {t('voice.fullscreen.openChat')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium backdrop-blur-sm transition-colors border border-white/10"
            title={t('voice.fullscreen.closeTitle')}
          >
            <X className="h-4 w-4 shrink-0" />
            {t('voice.fullscreen.close')}
          </button>
        </div>
      </div>,
      document.body
    );
  }
);

// ─── Public wrapper ───────────────────────────────────────────────────────────

const FullscreenStreamOverlay = memo(
  ({ userId, onClose }: TFullscreenStreamOverlayProps) => {
    const isElectron =
      typeof window !== 'undefined' && !!window.pulseDesktop?.streamViewer;

    if (isElectron) {
      return <ElectronFullscreenStream userId={userId} onClose={onClose} />;
    }

    return <WebFullscreenStream userId={userId} onClose={onClose} />;
  }
);

FullscreenStreamOverlay.displayName = 'FullscreenStreamOverlay';

export { FullscreenStreamOverlay };
