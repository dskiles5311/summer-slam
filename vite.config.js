import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Unique per build — forces a new bundle hash every deploy so CF Pages KV
    // always uploads a fresh file instead of reusing a potentially stale blob.
    __BUILD_TIME__: JSON.stringify(Date.now()),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
});
