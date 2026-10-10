import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Cognito's browser dependency on `buffer` expects Node's `global`.
  // Point that identifier at the standard browser global without adding a polyfill.
  define: { global: 'globalThis' },
  server: { port: 5173 },
  test: {
    environment: 'node',
    globals: true,
  } as never,
});
