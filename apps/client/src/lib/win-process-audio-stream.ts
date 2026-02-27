/**
 * Win Process Audio Worklet — Client Library
 *
 * Receives raw interleaved float32 PCM chunks from Electron IPC, feeds them
 * into a Web Audio AudioWorklet, and exposes a MediaStreamTrack that can be
 * added to the screen-share MediaStream.
 *
 * Usage:
 *   const capture = new WinProcessAudioStream(audioContext);
 *   const track = await capture.start();     // resolves on first audio chunk
 *   stream.addTrack(track);
 *   // …later…
 *   capture.stop();
 *   stream.removeTrack(track);
 */

// ── WinProcessAudioStream class ───────────────────────────────────────────────

const WORKLET_NAME = 'pulse-process-audio';
// Served as a static file from public/ — same origin, passes any 'self' CSP.
const WORKLET_URL = '/pulse-process-audio-worklet.js';

// Tracks which AudioContext instances have already had the worklet module added.
// Using a WeakSet so GC'd contexts are automatically cleaned up.
const registeredContexts = new WeakSet<AudioContext>();

export class WinProcessAudioStream {
  private readonly _ctx: AudioContext;
  private _workletNode: AudioWorkletNode | null = null;

  constructor(ctx: AudioContext) {
    this._ctx = ctx;
  }

  /**
   * Wire up the AudioWorklet with the provided format and start consuming
   * PCM chunks from Electron IPC.
   *
   * The caller must already have called `winProcessAudio.start()` and received
   * the `{ sampleRate, channels }` format result before calling this.
   */
  async start(channels: number): Promise<MediaStreamTrack> {
    const api = window.pulseDesktop?.winProcessAudio;
    if (!api) throw new Error('WinProcessAudioStream: winProcessAudio not available');

    // Register the worklet module once per AudioContext — not per instance.
    // Calling registerProcessor() twice on the same context throws DOMException.
    if (!registeredContexts.has(this._ctx)) {
      await this._ctx.audioWorklet.addModule(WORKLET_URL);
      registeredContexts.add(this._ctx);
    }

    // Create worklet node + destination with the known channel count
    const destination = this._ctx.createMediaStreamDestination();
    this._workletNode = new AudioWorkletNode(this._ctx, WORKLET_NAME, {
      numberOfOutputs: 1,
      outputChannelCount: [channels],
    });
    this._workletNode.connect(destination);

    // Forward IPC chunks into the worklet processor
    api.onChunk((buffer, _sr, ch) => {
      if (!this._workletNode) return;
      this._workletNode.port.postMessage({ type: 'chunk', buffer, channels: ch }, [buffer]);
    });

    const track = destination.stream.getAudioTracks()[0];
    if (!track) throw new Error('WinProcessAudioStream: no audio track from destination');
    return track;
  }

  /** Stop the worklet and remove IPC listeners. */
  stop(): void {
    window.pulseDesktop?.winProcessAudio?.offChunk?.();
    this._workletNode?.disconnect();
    this._workletNode = null;
  }
}
