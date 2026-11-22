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
