import { API_URL, UPLOAD_TIMEOUT_MS } from '@/config';
import type { Delivery } from '@/types/delivery';
import type { DevSettings } from '@/types/settings';
import {
  ClientError,
  ConfigError,
  MalformedResponseError,
  NetworkError,
  PhotoMissingError,
  ServerError,
  TimeoutError,
} from '@/utils/errors';

import { readPhotoBase64 } from './photoService';

export interface UploadResult {
  remoteId: string;
  /** True when the server had already stored this idempotency key. */
  replayed: boolean;
}

/** The sync engine depends only on this interface, never on fetch directly. */
export interface DeliveryApi {
  uploadDelivery(delivery: Delivery, devSettings?: DevSettings): Promise<UploadResult>;
}

function isUploadResult(value: unknown): value is UploadResult {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.remoteId === 'string' &&
    candidate.remoteId.length > 0 &&
    typeof candidate.replayed === 'boolean'
  );
}

function devHeaders(devSettings: DevSettings | undefined): Record<string, string> {
  if (!__DEV__ || !devSettings) return {};
  const headers: Record<string, string> = {};
  if (devSettings.failureMode !== 'off') headers['X-Simulate-Failure'] = devSettings.failureMode;
  if (devSettings.uploadDelayMs > 0) headers['X-Simulate-Delay-Ms'] = String(devSettings.uploadDelayMs);
  return headers;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'error' in body) {
      return String((body as { error: unknown }).error);
    }
  } catch {
    // Non-JSON error body; fall through to the status text.
  }
  return response.statusText || `HTTP ${response.status}`;
}

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

async function postJson(
  fetchFn: FetchFn,
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    return await fetchFn(url, { method: 'POST', headers, body, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new TimeoutError('Upload timed out');
    throw new NetworkError(error instanceof Error ? error.message : 'Network request failed');
  } finally {
    clearTimeout(timer);
  }
}

export class HttpDeliveryApi implements DeliveryApi {
  constructor(
    private readonly baseUrl: string | null = API_URL,
    private readonly fetchFn: FetchFn = (url, init) => fetch(url, init),
  ) {}

  async uploadDelivery(delivery: Delivery, devSettings?: DevSettings): Promise<UploadResult> {
    if (!this.baseUrl) {
      throw new ConfigError('EXPO_PUBLIC_API_URL is not set (see .env.example)');
    }

    const photoBase64 = await readPhotoBase64(delivery.photoPath);
    if (photoBase64 === null) throw new PhotoMissingError('Photo missing on device');

    const body = JSON.stringify({
      localId: delivery.id,
      supplierName: delivery.supplierName,
      poNumber: delivery.poNumber,
      note: delivery.note,
      createdAt: delivery.createdAt,
      photo: { mimeType: 'image/jpeg', base64: photoBase64 },
    });

    const response = await postJson(
      this.fetchFn,
      `${this.baseUrl}/deliveries`,
      {
        'Content-Type': 'application/json',
        'Idempotency-Key': delivery.idempotencyKey,
        ...devHeaders(devSettings),
      },
      body,
    );

    if (response.status >= 500) {
      throw new ServerError(response.status, await readErrorMessage(response));
    }
    if (response.status >= 400) {
      throw new ClientError(response.status, await readErrorMessage(response));
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new MalformedResponseError('Response was not valid JSON');
    }
    if (!isUploadResult(payload)) {
      throw new MalformedResponseError('Response is missing remoteId/replayed');
    }
    return { remoteId: payload.remoteId, replayed: payload.replayed };
  }
}

/** Dev screen helper: how many deliveries the mock server has stored. */
export async function fetchServerDeliveryCount(baseUrl: string | null = API_URL): Promise<number> {
  if (!baseUrl) throw new ConfigError('EXPO_PUBLIC_API_URL is not set');
  const response = await fetch(`${baseUrl}/deliveries`);
  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null || typeof (body as { count?: unknown }).count !== 'number') {
    throw new MalformedResponseError('Unexpected response from GET /deliveries');
  }
  return (body as { count: number }).count;
}
