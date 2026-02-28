/// <reference types="vite/client" />
/// <reference types="zzfx" />

// Allow <webview> JSX in Electron renderer
declare namespace React {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        allowpopups?: string;
        partition?: string;
        useragent?: string;
        disablewebsecurity?: string;
        ref?: React.Ref<HTMLElement>;
      };
    }
  }
}

// Pulse Desktop (Electron) bridge API
interface PulseDesktopAudioDriver {
  getStatus(): Promise<{ supported: boolean; fileInstalled: boolean; active: boolean }>;
  install(): Promise<{ success: boolean; error?: string }>;
  uninstall(): Promise<{ success: boolean; error?: string }>;
}

interface PulseDesktopAudioCapture {
  isAvailable(): Promise<boolean>;
  start(): Promise<{ pulseDeviceUID: string; realOutputDeviceName: string } | null>;
  stop(): Promise<void>;
}

interface DesktopCapturerSourceSerialized {
  id: string;
  name: string;
  thumbnail: string | { toDataURL(): string };
}

interface PulseDesktopScreenPicker {
  onShow(callback: (sources: DesktopCapturerSourceSerialized[]) => void): void;
  select(sourceId: string, audio: boolean): Promise<void>;
  cancel(): Promise<void>;
  getSources(): Promise<DesktopCapturerSourceSerialized[]>;
}

/** Relays a live screen-share stream to a dedicated fullscreen viewer BrowserWindow
 *  using a local WebRTC loopback peer connection for stream transfer. */
interface PulseDesktopStreamViewer {
  /** Open the viewer window for the given voice channel, return its webContentsId. */
  open(channelId: number): Promise<number | null>;
  /** Close the viewer window. */
  close(): Promise<void>;
  /** Source renderer → viewer: send WebRTC signaling data. */
  signalToViewer(data: unknown): void;
  /** Viewer renderer → source: send WebRTC signaling data. */
  signalToSource(data: unknown): void;
  /** Register a handler for incoming signaling data from the other side. */
  onSignal(cb: (data: unknown) => void): void;
  /** Remove the signal handler. */
  offSignal(): void;
  /** Viewer calls this when its RTCPeerConnection is ready to receive an offer. */
  sendViewerReady(): void;
  /** Source calls this to wait for the viewer to signal readiness. */
  onViewerReady(cb: () => void): void;
  /** Fired in the source renderer when the viewer window has been closed. */
  onViewerClosed(cb: () => void): void;
  offViewerClosed(): void;
}

/** Windows process-loopback audio capture (Win10 build 20348 / Win11+). */
interface PulseDesktopWinProcessAudio {
  canCapture(): Promise<boolean>;
  getPendingSource(): Promise<string | null>;
  start(sourceId: string): Promise<{ sampleRate: number; channels: number } | null>;
  stop(): Promise<void>;
  onChunk(callback: (buffer: ArrayBuffer, sampleRate: number, channels: number) => void): void;
  offChunk(): void;
}

interface PulseDesktop {
  isElectron: true;
  platform: string;
  connectToServer(url: string): Promise<{ success: boolean; name?: string; version?: string; error?: string }>;
  disconnectServer(): Promise<void>;
  getSettings(): Promise<Record<string, unknown>>;
  updateSetting(key: string, value: unknown): Promise<void>;
  audioDriver: PulseDesktopAudioDriver;
  audioCapture: PulseDesktopAudioCapture;
  /** Windows only — custom screen/window picker with system-audio toggle. */
  screenPicker?: PulseDesktopScreenPicker;
  /** Windows only — WASAPI process loopback capture for screen sharing. */
  winProcessAudio?: PulseDesktopWinProcessAudio;
  /** Desktop global-hotkey event — register a callback to toggle mic. */
  onToggleMute?(cb: () => void): void;
  /** Fullscreen stream viewer window (Electron only). */
  streamViewer?: PulseDesktopStreamViewer;
}

// Extend the Window interface for global functions
declare global {
  interface Window {
    printVoiceStats?: () => void;
    DEBUG?: boolean;
    pulseDesktop?: PulseDesktop;
  }

  const VITE_APP_VERSION: string;
}

export {};
