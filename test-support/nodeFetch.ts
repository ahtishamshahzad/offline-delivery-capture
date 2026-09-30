import http from 'node:http';

/**
 * Minimal fetch over node:http for integration tests. The jest-expo preset
 * replaces global fetch with Expo's native implementation, which cannot reach
 * the network under Jest. Supports what HttpDeliveryApi uses: method, headers,
 * string body, AbortSignal, status and json().
 */
export function nodeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      url,
      { method: init.method ?? 'GET', headers: init.headers as Record<string, string> | undefined },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            status: res.statusCode ?? 0,
            statusText: res.statusMessage ?? '',
            ok: (res.statusCode ?? 0) < 400,
            json: async () => JSON.parse(text),
            text: async () => text,
          } as unknown as Response);
        });
        res.on('error', reject);
      },
    );
    const signal = init.signal;
    if (signal) {
      if (signal.aborted) {
        request.destroy();
        reject(new Error('Aborted'));
        return;
      }
      signal.addEventListener('abort', () => {
        request.destroy();
        reject(new Error('Aborted'));
      });
    }
    request.on('error', reject);
    if (typeof init.body === 'string') request.write(init.body);
    request.end();
  });
}
