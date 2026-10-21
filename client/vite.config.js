import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
      // The money/split/balance rules live in one place at the repo root and
      // are imported by both the API and this client, so the two can never
      // disagree about how an expense is split or formatted.
      '@shared': path.resolve(process.cwd(), '../shared'),
    },
  },
  server: {
    port: 5173,
    fs: {
      // Allow the dev server to read ../shared, which sits outside the client root.
      allow: ['..'],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Keep the charting library out of the main bundle so the first paint
        // of the login screen does not pay for it.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
  },
});
