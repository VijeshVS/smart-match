import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// talent.ai Candidate Portal — http://localhost:3000
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
  },
  preview: {
    port: 3000,
    host: true,
  },
});
