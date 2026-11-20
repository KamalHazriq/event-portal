/**
 * Device check: what this phone or laptop can do, in plain words.
 * Pure helpers; the browser probing is in DeviceCheck.tsx.
 */
export type CheckState = 'good' | 'warn' | 'bad' | 'info';

export type CheckResult = {
  id: string;
  label: string;
  state: CheckState;
  detail: string;
};

/** Median of the numbers, rounded; 0 for none. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2);
}

/** How fast the portal answers from here. */
export function latencyState(ms: number): CheckState {
  return ms <= 400 ? 'good' : ms <= 1200 ? 'warn' : 'bad';
}

/**
 * This device's clock against the server's. The ?now= tests and the
 * countdown depend on both agreeing. Seconds, either direction.
 */
export function clockState(offsetMs: number): CheckState {
  const seconds = Math.abs(offsetMs) / 1000;
  return seconds <= 5 ? 'good' : seconds <= 60 ? 'warn' : 'bad';
}

export function describeOffset(offsetMs: number): string {
  const seconds = Math.round(Math.abs(offsetMs) / 1000);
  if (seconds <= 1) return 'In step with the server.';
  return `${seconds} seconds ${offsetMs > 0 ? 'ahead of' : 'behind'} the server.`;
}

/** What to paste into a message, one line per check. */
export function summarise(results: CheckResult[]): string {
  const mark: Record<CheckState, string> = {
    good: 'OK  ',
    warn: 'WARN',
    bad: 'FAIL',
    info: 'INFO',
  };
  return results.map((r) => `${mark[r.state]} ${r.label}: ${r.detail}`).join('\n');
}
