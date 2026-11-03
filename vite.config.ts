
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    plugins: [react(), tailwindcss()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    server: {
      // Keep HMR settings for local development and AI Studio.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
    },

    preview: {
      host: '0.0.0.0',
      port: 4173,
      strictPort: true,
    },

    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: !isProduction,

      // Keep production assets optimized.
      minify: true,

      // Vite/Rolldown build configuration.
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'react-vendor',
                test: /node_modules\/(react|react-dom|scheduler)\//,
              },
              {
                name: 'router-vendor',
                test: /node_modules\/(react-router|react-router-dom)\//,
              },
              {
                name: 'chart-vendor',
                test: /node_modules\/(recharts|chart\.js|react-chartjs-2)\//,
              },
              {
                name: 'icon-vendor',
                test: /node_modules\/(lucide-react|@fortawesome)\//,
              },
            ],
          },
        },
      },

      // Warning threshold only; does not reduce actual bundle size.
      chunkSizeWarningLimit: 700,
    },
  };
});
