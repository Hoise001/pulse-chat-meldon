class ProcessAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._channels = 0;
    this._buffers = [];
    this._bufSize = 0;
    this._writePos = 0;
    this._readPos = 0;
    this._available = 0;

    this.port.onmessage = (e) => {
      const { type, buffer, channels } = e.data;
      if (type !== 'chunk' || !buffer) return;

      const interleaved = new Float32Array(buffer);
      const frames = interleaved.length / channels;

      if (this._channels !== channels || this._bufSize === 0) {
        this._bufSize = 48000 * 0.5; // 24000 frames (~500ms at 48kHz)
        this._channels = channels;
        this._buffers = Array.from({ length: channels }, () => new Float32Array(this._bufSize));
        this._writePos = 0;
        this._readPos = 0;
        this._available = 0;
      }

      for (let f = 0; f < frames; f++) {
        const wp = (this._writePos + f) % this._bufSize;
        for (let ch = 0; ch < channels; ch++) {
          this._buffers[ch][wp] = interleaved[f * channels + ch];
        }
      }
      this._writePos = (this._writePos + frames) % this._bufSize;
      this._available = Math.min(this._available + frames, this._bufSize);
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const frameCount = output[0].length;
    const outChannels = output.length;

    if (this._available < frameCount || this._bufSize === 0) {
      for (let ch = 0; ch < outChannels; ch++) output[ch].fill(0);
      return true;
    }

    for (let f = 0; f < frameCount; f++) {
      const rp = (this._readPos + f) % this._bufSize;
      for (let ch = 0; ch < outChannels; ch++) {
        const srcCh = ch < this._channels ? ch : 0;
        output[ch][f] = this._buffers[srcCh][rp];
      }
    }

    this._readPos = (this._readPos + frameCount) % this._bufSize;
    this._available -= frameCount;

    return true;
  }
}

registerProcessor('pulse-process-audio', ProcessAudioProcessor);
