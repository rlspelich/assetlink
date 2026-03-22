import ky from 'ky';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';
const DEV_TENANT_ID = import.meta.env.VITE_DEV_TENANT_ID;

// Token getter — set by ClerkProvider or left null for dev mode
let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn;
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
  },
});
