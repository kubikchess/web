// SPDX-License-Identifier: GPL-3.0-or-later
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const apiTarget = process.env.DICECHESS_API_URL ?? 'http://127.0.0.1:8000';
// X-Forwarded-For with the client address; the API trusts it only from DICECHESS_TRUSTED_PROXIES
// (`scripts/dev.sh --lan` sets it, so rate limits count each computer, not the proxy).
const toApi = { target: apiTarget, xfwd: true };

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/auth': toApi,
      '/dev': toApi,
      '/games': toApi,
      '/health': toApi,
      '/legal': toApi,
      '/ws': { ...toApi, ws: true },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
