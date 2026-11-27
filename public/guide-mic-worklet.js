// The live guide's microphone, in the audio thread (lib/guide/live.ts): averages
// the device's rate down to 16 kHz and hands over 100 ms of 16-bit samples at a
// time. A file of its own, not a blob, so the site's script policy allows it.
class Down extends AudioWorkletProcessor {
  constructor() { super(); this.ratio = sampleRate / 16000; this.acc = 0; this.sum = 0; this.n = 0; this.buf = new Int16Array(1600); this.i = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let k = 0; k < ch.length; k++) {
      this.sum += ch[k]; this.n++; this.acc += 1;
      if (this.acc >= this.ratio) {
        this.acc -= this.ratio;
        const v = Math.max(-1, Math.min(1, this.sum / this.n));
        this.sum = 0; this.n = 0;
        this.buf[this.i++] = v < 0 ? v * 0x8000 : v * 0x7fff;
        if (this.i === this.buf.length) { this.port.postMessage(this.buf.buffer.slice(0)); this.i = 0; }
      }
    }
    return true;
  }
}
registerProcessor('aibos-down', Down);
