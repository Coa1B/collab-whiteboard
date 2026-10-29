import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The server only accepts connections from this origin (CLIENT_ORIGIN),
  // so fail fast instead of silently moving to another port.
  server: { port: 5173, strictPort: true },
});
