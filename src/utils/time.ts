export function now(): number {
  return Date.now();
}

export function formatRelative(timestamp: number, reference: number = Date.now()): string {
  const seconds = Math.round((reference - timestamp) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function formatDateTime(timestamp: number | null): string {
  return timestamp === null ? '—' : new Date(timestamp).toLocaleString();
}

/** Whole seconds until `timestamp`, never negative. */
export function secondsUntil(timestamp: number, reference: number = Date.now()): number {
  return Math.max(0, Math.ceil((timestamp - reference) / 1000));
}
