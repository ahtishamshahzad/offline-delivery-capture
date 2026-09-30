import * as Crypto from 'expo-crypto';

export function newId(): string {
  return Crypto.randomUUID();
}

/** Stable per delivery: derived from the local id, never regenerated. */
export function idempotencyKeyFor(deliveryId: string): string {
  return `delivery-${deliveryId}`;
}

export function shortId(id: string): string {
  return id.slice(0, 6);
}
