import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    server: {
      // Disable HMR to prevent WebSocket connection failures in sandboxed reverse proxy environments
      hmr: false,
      watch: null,
      host: '0.0.0.0',
      allowedHosts: ['smartproduct-manager.onrender.com'],
    },

    preview: {
      host: '0.0.0.0',
      allowedHosts: ['smartproduct-manager.onrender.com'],
    },
  };
});
