/**
 * AudioWorklet processor for PersonaPlex real-time audio playback.
 * Buffers incoming Float32 PCM frames in a ring buffer and outputs
 * 128 samples per process() call. Drops oldest frames on overflow.
 */
class MoshiProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffers = [];
    this.totalFrames = 0;
    this.playedFrames = 0;
    this.actualPlayed = 0;
    this.currentOffset = 0;
    this.micDuration = 0;

    this.port.onmessage = (e) => {
      if (e.data.type === 'reset') {
        this.buffers = [];
        this.totalFrames = 0;
        this.playedFrames = 0;
        this.actualPlayed = 0;
        this.currentOffset = 0;
        return;
      }
      if (e.data.type === 'audio') {
        this.buffers.push(e.data.frame);
        this.totalFrames += e.data.frame.length;
        this.micDuration = e.data.micDuration;

        // Drop old frames if buffer grows too large (>2s at sample rate)
        const maxBuffer = sampleRate * 2;
        while (this.totalFrames - this.playedFrames > maxBuffer && this.buffers.length > 1) {
          const dropped = this.buffers.shift();
          this.playedFrames += dropped.length;
          this.currentOffset = 0;
        }
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0][0];
    if (!output) return true;

    let written = 0;
    while (written < output.length && this.buffers.length > 0) {
      const buf = this.buffers[0];
      const available = buf.length - this.currentOffset;
      const needed = output.length - written;
      const toCopy = Math.min(available, needed);

      for (let i = 0; i < toCopy; i++) {
        output[written + i] = buf[this.currentOffset + i];
      }
      written += toCopy;
      this.currentOffset += toCopy;
      this.actualPlayed += toCopy;

      if (this.currentOffset >= buf.length) {
        this.buffers.shift();
        this.playedFrames += buf.length;
        this.currentOffset = 0;
      }
    }

    // Fill remaining with silence
    for (let i = written; i < output.length; i++) {
      output[i] = 0;
    }

    // Report stats back to main thread
    const delay = (this.totalFrames - this.playedFrames - this.currentOffset) / sampleRate;
    this.port.postMessage({
      totalAudioPlayed: this.playedFrames / sampleRate,
      actualAudioPlayed: this.actualPlayed / sampleRate,
      delay,
      minDelay: 0,
      maxDelay: 0,
    });

    return true;
  }
}

registerProcessor('moshi-processor', MoshiProcessor);
