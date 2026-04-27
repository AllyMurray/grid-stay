import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  root: path.resolve(__dirname, 'harness'),
  plugins: [react(), tsconfigPaths()],
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
});
