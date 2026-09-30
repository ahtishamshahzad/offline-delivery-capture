/** Typed upload errors. The retry policy decides what to do based on the class. */
export class NetworkError extends Error {
  readonly name = 'NetworkError';
}

export class TimeoutError extends Error {
  readonly name = 'TimeoutError';
}

export class ServerError extends Error {
  readonly name = 'ServerError';
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class ClientError extends Error {
  readonly name = 'ClientError';
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class MalformedResponseError extends Error {
  readonly name = 'MalformedResponseError';
}

export class PhotoMissingError extends Error {
  readonly name = 'PhotoMissingError';
}

export class ConfigError extends Error {
  readonly name = 'ConfigError';
}

/** Short, human copy shown on the delivery card. */
export function toUserMessage(error: unknown): string {
  if (error instanceof TimeoutError) return 'Upload timed out';
  if (error instanceof NetworkError) return "Can't reach server";
  if (error instanceof ServerError) return `Server error (${error.status})`;
  if (error instanceof ClientError) return `Rejected by server (${error.status}): ${error.message}`;
  if (error instanceof MalformedResponseError) return 'Unexpected server response';
  if (error instanceof PhotoMissingError) return 'Photo missing on device';
  if (error instanceof ConfigError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}
