/**
 * Public runtime config. EXPO_PUBLIC_* values are inlined at build time and are
 * visible in the bundle — never put secrets here.
 */
const rawApiUrl = process.env.EXPO_PUBLIC_API_URL;

export const API_URL: string | null = rawApiUrl ? rawApiUrl.replace(/\/+$/, '') : null;

/** Client-side upload timeout. Longer than the largest simulated delay (8 s). */
export const UPLOAD_TIMEOUT_MS = 15_000;
