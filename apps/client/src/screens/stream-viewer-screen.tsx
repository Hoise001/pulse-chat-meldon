import { TextChannel } from '@/components/channel-view/text';
import { VolumeControlProvider } from '@/components/voice-provider/volume-control-context';
import { cn } from '@/lib/utils';
import { MessageSquare, X } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type TStreamViewerScreenProps = {
  channelId: number;
};

/**
 * Fullscreen stream viewer that runs inside the dedicated Electron viewer
 * BrowserWindow. It consumes the screen-share stream from the source renderer
 * via a local WebRTC loopback connection and shows a toggleable text-chat panel
 * for the voice channel.
 */
const StreamViewerScreen = memo(({ channelId }: TStreamViewerScreenProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [streamReady, setStreamReady] = useState(false);

  // Set up WebRTC consumer + signal readiness to the source window.
  useEffect(() => {
    const svApi = window.pulseDesktop?.streamViewer;
    if (!svApi) return;

    const pc = new RTCPeerConnection({ iceServers: [] });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        svApi.signalToSource({ type: 'ice', candidate: e.candidate.toJSON() });
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        setStreamReady(true);
      }
    };

    svApi.onSignal(async (data: unknown) => {
      const msg = data as { type: string; sdp?: string; candidate?: RTCIceCandidateInit };
      try {
        if (msg.type === 'offer' && msg.sdp) {
          await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          svApi.signalToSource({ type: 'answer', sdp: answer.sdp });
        } else if (msg.type === 'ice' && msg.candidate) {
          await pc.addIceCandidate(msg.candidate);
        }
      } catch {
        // ICE failures during loopback are non-fatal
      }
    });

    // Tell the source renderer our RTCPeerConnection is ready for the offer.
    svApi.sendViewerReady();

    return () => {
      svApi.offSignal();
      pc.close();
      pcRef.current = null;
    };
  }, []);

  // Escape key closes the viewer window.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.pulseDesktop?.streamViewer?.close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleClose = useCallback(() => {
    window.pulseDesktop?.streamViewer?.close();
  }, []);

  const handleToggleChat = useCallback(() => {
    setChatOpen((prev: boolean) => !prev);
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[9000] bg-black flex select-none">
      {/* Stream video */}
      <div className="flex-1 relative flex items-center justify-center min-w-0">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-contain"
        />

        {/* Placeholder while stream is connecting */}
        {!streamReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white/40 text-sm">Connecting stream…</p>
          </div>
        )}

        {/* Controls — bottom-right corner, fade in on hover */}
        <div className="absolute bottom-6 right-6 flex items-center gap-3 opacity-30 hover:opacity-100 transition-opacity duration-200">
          <button
            type="button"
            onClick={handleToggleChat}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-medium backdrop-blur-sm transition-colors border',
              chatOpen
                ? 'bg-primary/80 hover:bg-primary border-primary/50'
                : 'bg-white/10 hover:bg-white/20 border-white/10'
            )}
            title="Toggle chat (voice channel text)"
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            Chat
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-red-500/60 text-white text-sm font-medium backdrop-blur-sm transition-colors border border-white/10"
            title="Close fullscreen viewer (Esc)"
          >
            <X className="h-4 w-4 shrink-0" />
            Close
          </button>
        </div>
      </div>

      {/* Text-chat side panel */}
      {chatOpen && (
        <div className="w-[380px] shrink-0 border-l border-white/10 flex flex-col bg-background overflow-hidden">
          <VolumeControlProvider>
            <TextChannel channelId={channelId} />
          </VolumeControlProvider>
        </div>
      )}
    </div>,
    document.body
  );
});

StreamViewerScreen.displayName = 'StreamViewerScreen';

export { StreamViewerScreen };
