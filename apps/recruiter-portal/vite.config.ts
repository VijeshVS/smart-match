import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// talent.ai Recruiter Portal — http://localhost:3001
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: true,
  },
  preview: {
    port: 3001,
    host: true,
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
