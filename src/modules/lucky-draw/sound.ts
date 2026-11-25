/**
 * Sound for the lucky draw on the projector: a soft tick for each name in the
 * spin, and a short fanfare for the winner. Made with the browser's own
 * synthesiser, so there is no file to download.
 *
 * Browsers only allow sound after someone has clicked or pressed a key on the
 * page. SoundUnlock listens for that first touch; until then everything here
 * is silent, and the draw shows a small hint.
 */
type Ctx = AudioContext;

let context: Ctx | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function soundReady(): boolean {
  return context?.state === 'running';
}

export function subscribeSound(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Call from a click or key press. Safe to call many times. */
export function unlockSound(): void {
  try {
    if (!context) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      context = new Ctor();
      context.onstatechange = notify;
    }
    void context.resume().then(notify, () => undefined);
  } catch {
    // No sound on this machine: the draw works the same without it.
  }
}

function tone(freq: number, at: number, length: number, volume: number, type: OscillatorType) {
  if (!context || context.state !== 'running') return;
  const start = context.currentTime + at;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  // A quick rise and a smooth fade, so nothing clicks.
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(context.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

/** One name going past in the spin. */
export function playTick(): void {
  tone(1400, 0, 0.04, 0.05, 'square');
}

/** The winner: a rising arpeggio and a held chord. */
export function playFanfare(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => tone(freq, i * 0.11, 0.25, 0.09, 'triangle'));
  [523.25, 659.25, 783.99].forEach((freq) => tone(freq, 0.5, 1.2, 0.06, 'triangle'));
}

/* ---------------------------------------------------------- drum and impact */

let noise: AudioBuffer | null = null;

function noiseBuffer(): AudioBuffer | null {
  if (!context) return null;
  if (!noise) {
    noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** A burst of filtered noise: a snare hit, a cymbal, or a rising whoosh. */
function burst(
  at: number,
  length: number,
  volume: number,
  filter: { type: BiquadFilterType; from: number; to?: number },
) {
  if (!context || context.state !== 'running') return;
  const buffer = noiseBuffer();
  if (!buffer) return;
  const start = context.currentTime + at;
  const source = context.createBufferSource();
  source.buffer = buffer;
  const biquad = context.createBiquadFilter();
  biquad.type = filter.type;
  biquad.frequency.setValueAtTime(filter.from, start);
  if (filter.to) biquad.frequency.exponentialRampToValueAtTime(filter.to, start + length);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  source.connect(biquad).connect(gain).connect(context.destination);
  source.start(start, Math.random());
  source.stop(start + length + 0.02);
}

/** A low drum: a sine that drops in pitch. */
function thump(at: number, volume: number, from = 140, to = 45, length = 0.35) {
  if (!context || context.state !== 'running') return;
  const start = context.currentTime + at;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + length);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(context.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

/**
 * A snare roll that speeds up and gets louder over `seconds`, with a rising
 * whoosh under it. The longer it is, the more it builds (the winner's is long).
 */
export function playDrumRoll(seconds: number, big = false): void {
  const hits = Math.round(seconds * 16);
  for (let i = 0; i < hits; i++) {
    const t = i / hits; // 0 to 1 along the roll
    // Faster and louder as it goes: hits bunch up towards the end.
    const at = seconds * (1 - Math.pow(1 - t, 1.6));
    burst(at, 0.07, 0.04 + t * (big ? 0.16 : 0.1), { type: 'bandpass', from: 1900 + t * 600 });
    if (i % 4 === 0) thump(at, 0.05 + t * 0.06, 110, 70, 0.12);
  }
  burst(0, seconds, big ? 0.07 : 0.04, { type: 'highpass', from: 400, to: 6000 });
}

/** The hit at the end of a roll: a big drum and a cymbal. The winner's is bigger. */
export function playImpact(big = false): void {
  thump(0, big ? 0.55 : 0.35, 160, 40, big ? 0.9 : 0.5);
  burst(0, big ? 2.2 : 1.1, big ? 0.22 : 0.14, { type: 'highpass', from: 5000 });
  if (big) {
    thump(0.02, 0.4, 90, 30, 1.2);
    burst(0.05, 1.6, 0.1, { type: 'bandpass', from: 1200, to: 300 });
  }
}

/** A little rising run for a place that is not a podium step. */
export function playPing(rank: number): void {
  tone(660 + (10 - Math.min(rank, 10)) * 40, 0, 0.18, 0.05, 'triangle');
}
