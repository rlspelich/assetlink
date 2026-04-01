import ky from 'ky';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';
const DEV_TENANT_ID = import.meta.env.VITE_DEV_TENANT_ID;

// Token getter — set by ClerkProvider or left null for dev mode
let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn;
}

/** Build URLSearchParams from an object, skipping undefined/null/empty values. */
export function buildSearchParams(
  params: Record<string, string | number | boolean | undefined | null>,
): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      sp.set(k, String(v));
    }
  }
  return sp;
}

export const api = ky.create({
  prefixUrl: API_URL,
  hooks: {
    beforeRequest: [
      async (request) => {
        if (_getToken) {
          const token = await _getToken();
          if (token) {
            request.headers.set('Authorization', `Bearer ${token}`);
            return;
          }
        }
        // Dev fallback — no Clerk, use tenant ID header
        if (DEV_TENANT_ID) {
          request.headers.set('X-Tenant-ID', DEV_TENANT_ID);
        }
      },
    ],
    afterResponse: [
      async (_request, _options, response) => {
        if (!response.ok) {
          let detail = response.statusText;
          try {
            const body = await response.json();
            if (body && typeof body === 'object' && 'detail' in body) {
              detail = (body as { detail: string }).detail;
            }
          } catch {
            // body not JSON, use statusText
          }
          console.error(`[API ${response.status}] ${_request.url}: ${detail}`);
        }
      },
    ],
  },
});
