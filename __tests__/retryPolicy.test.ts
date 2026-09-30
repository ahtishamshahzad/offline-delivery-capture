import { isRetryable, MAX_AUTO_RETRIES, nextDelayMs, shouldAutoRetry } from '@/sync/retryPolicy';
import {
  ClientError,
  ConfigError,
  MalformedResponseError,
  NetworkError,
  PhotoMissingError,
  ServerError,
  TimeoutError,
} from '@/utils/errors';

test('delays double after each failed attempt: 2 s, 4 s, 8 s, 16 s', () => {
  expect([1, 2, 3, 4].map(nextDelayMs)).toEqual([2000, 4000, 8000, 16000]);
});

test('delay is capped at 60 s', () => {
  expect(nextDelayMs(10)).toBe(60_000);
});

test.each([
  ['network', new NetworkError('x')],
  ['timeout', new TimeoutError('x')],
  ['5xx', new ServerError(503, 'x')],
  ['429', new ClientError(429, 'x')],
  ['malformed response', new MalformedResponseError('x')],
])('%s errors are retryable', (_, error) => {
  expect(isRetryable(error)).toBe(true);
});

test.each([
  ['4xx', new ClientError(400, 'x')],
  ['missing photo', new PhotoMissingError('x')],
  ['missing config', new ConfigError('x')],
  ['unknown', new Error('x')],
])('%s errors are permanent', (_, error) => {
  expect(isRetryable(error)).toBe(false);
});

test('auto-retry stops once the attempt cap is reached', () => {
  const error = new NetworkError('x');
  expect(shouldAutoRetry(error, MAX_AUTO_RETRIES - 1)).toBe(true);
  expect(shouldAutoRetry(error, MAX_AUTO_RETRIES)).toBe(false);
});
