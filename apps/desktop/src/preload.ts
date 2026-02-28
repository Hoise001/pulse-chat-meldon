import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('pulseDesktop', {
  isElectron: true,
  platform: process.platform,
  connectToServer: (url: string) => ipcRenderer.invoke('connect-to-server', url),
  disconnectServer: () => ipcRenderer.invoke('disconnect-server'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSetting: (key: string, value: unknown) => ipcRenderer.invoke('update-setting', key, value),

  // macOS audio driver management
  audioDriver: {
    getStatus: () => ipcRenderer.invoke('audio-driver:status') as Promise<{ supported: boolean; fileInstalled: boolean; active: boolean }>,
    install: () => ipcRenderer.invoke('audio-driver:install') as Promise<{ success: boolean; error?: string }>,
    uninstall: () => ipcRenderer.invoke('audio-driver:uninstall') as Promise<{ success: boolean; error?: string }>,
  },

  // macOS system audio capture for screen sharing
  audioCapture: {
    isAvailable: () => ipcRenderer.invoke('audio-capture:available') as Promise<boolean>,
    start: () => ipcRenderer.invoke('audio-capture:start') as Promise<{ pulseDeviceUID: string; realOutputDeviceName: string } | null>,
    stop: () => ipcRenderer.invoke('audio-capture:stop') as Promise<void>,
  },

  // Windows process-loopback audio capture — captures audio from the specific
  // application window being screen-shared (Win10 build 20348 / Win11+).
  winProcessAudio: {
    /** Returns true if WASAPI Process Loopback is supported on this OS build. */
    canCapture: () => ipcRenderer.invoke('win-process-audio:can-capture') as Promise<boolean>,
    /**
     * After getDisplayMedia resolves for a window source, retrieve the pending
     * source ID that the main process stored (set only if the user picked a
     * window source with audio in the screen picker).
     */
    getPendingSource: () => ipcRenderer.invoke('win-process-audio:get-pending-source') as Promise<string | null>,
    /** Start capture for the window identified by the desktopCapturer sourceId.
     *  Resolves with { sampleRate, channels } once the first audio packet arrives,
     *  or null on failure. */
    start: (sourceId: string) => ipcRenderer.invoke('win-process-audio:start', sourceId) as Promise<{ sampleRate: number; channels: number } | null>,
    /** Stop the current capture session. */
    stop: () => ipcRenderer.invoke('win-process-audio:stop') as Promise<void>,
    /** Register a persistent handler for PCM chunk packets. */
    onChunk: (callback: (buffer: ArrayBuffer, sampleRate: number, channels: number) => void) => {
      ipcRenderer.removeAllListeners('win-process-audio:chunk');
      ipcRenderer.on('win-process-audio:chunk', (_e, buffer: ArrayBuffer, sampleRate: number, channels: number) =>
        callback(buffer, sampleRate, channels)
      );
    },
    /** Remove the chunk listener. */
    offChunk: () => {
      ipcRenderer.removeAllListeners('win-process-audio:chunk');
    },
  },

  // Global hotkey → mute toggle IPC bridge
  onToggleMute: (cb: () => void) => {
    ipcRenderer.removeAllListeners('hotkey:toggle-mute');
    ipcRenderer.on('hotkey:toggle-mute', () => cb());
  },

  // Fullscreen stream viewer window — relays a screen-share MediaStream to a
  // dedicated BrowserWindow via local WebRTC loopback + IPC signaling.
  streamViewer: {
    open: (channelId: number) =>
      ipcRenderer.invoke('stream-viewer:open', channelId) as Promise<number | null>,
    close: () => ipcRenderer.invoke('stream-viewer:close'),
    signalToViewer: (data: unknown) =>
      ipcRenderer.send('stream-viewer:signal-to-viewer', data),
    signalToSource: (data: unknown) =>
      ipcRenderer.send('stream-viewer:signal-to-source', data),
    onSignal: (cb: (data: unknown) => void) => {
      ipcRenderer.removeAllListeners('stream-viewer:signal');
      ipcRenderer.on('stream-viewer:signal', (_e, data) => cb(data));
    },
    offSignal: () => ipcRenderer.removeAllListeners('stream-viewer:signal'),
    sendViewerReady: () => ipcRenderer.send('stream-viewer:viewer-ready'),
    onViewerReady: (cb: () => void) => {
      ipcRenderer.removeAllListeners('stream-viewer:viewer-ready');
      ipcRenderer.on('stream-viewer:viewer-ready', () => cb());
    },
    onViewerClosed: (cb: () => void) => {
      ipcRenderer.removeAllListeners('stream-viewer:closed');
      ipcRenderer.on('stream-viewer:closed', () => cb());
    },
    offViewerClosed: () => ipcRenderer.removeAllListeners('stream-viewer:closed'),
  },

  // Windows screen picker — lets the renderer show a custom source-selection
  // dialog and pass the audio-toggle value back to the main process before
  // getDisplayMedia resolves.
  screenPicker: {
    /** Register a callback that fires when the main process needs a source. */
    onShow: (callback: (sources: DesktopCapturerSourceSerialized[]) => void) => {
      // Remove any previous listener to avoid duplicates across HMR reloads.
      ipcRenderer.removeAllListeners('screen-picker:show');
      ipcRenderer.on('screen-picker:show', (_event, sources: DesktopCapturerSourceSerialized[]) => callback(sources));
    },
    /** Confirm the selection; `audio` controls system loopback capture. */
    select: (sourceId: string, audio: boolean) =>
      ipcRenderer.invoke('screen-picker:select', sourceId, audio),
    /** Cancel the picker (aborts getDisplayMedia). */
    cancel: () => ipcRenderer.invoke('screen-picker:cancel'),
    /** Fetch fresh thumbnails while the picker is open. */
    getSources: () => ipcRenderer.invoke('screen-picker:get-sources') as Promise<DesktopCapturerSourceSerialized[]>,
  },
});

// Minimal serialised shape that the renderer sees for each capturer source.
interface DesktopCapturerSourceSerialized {
  id: string;
  name: string;
  thumbnail: string | { toDataURL(): string };
}
