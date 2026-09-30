import {
  MalformedResponseError,
  NetworkError,
  ServerError,
  TimeoutError,
  ClientError,
} from '@/utils/errors';

/** Automatic attempts before a delivery waits for a manual Retry. */
export const MAX_AUTO_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 60_000;

/**
 * Delay before the next attempt, given how many attempts have failed so far.
 * 1 → 2 s, 2 → 4 s, 3 → 8 s, 4 → 16 s (capped at 60 s).
 */
export function nextDelayMs(failedAttempts: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** failedAttempts, MAX_DELAY_MS);
}

/** Transient problems are retried automatically; permanent ones need the user. */
export function isRetryable(error: unknown): boolean {
  if (error instanceof ClientError) return error.status === 429;
  return (
    error instanceof NetworkError ||
    error instanceof TimeoutError ||
    error instanceof ServerError ||
    error instanceof MalformedResponseError
  );
}

export function shouldAutoRetry(error: unknown, failedAttempts: number): boolean {
  return isRetryable(error) && failedAttempts < MAX_AUTO_RETRIES;
}
