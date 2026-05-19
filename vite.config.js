import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

function stampSwVersion() {
  return {
    name: 'stamp-sw-version',
    closeBundle() {
      const swPath = resolve(__dirname, 'dist/sw.js');
      const content = readFileSync(swPath, 'utf8');
      writeFileSync(swPath, content.replace(/summer-slam-[\w]+/, `summer-slam-${Date.now()}`));
    },
  };
}

export default defineConfig({
  plugins: [react(), stampSwVersion()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
});
