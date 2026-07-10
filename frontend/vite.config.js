import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api-brevo': {
        target: 'https://api.brevo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-brevo/, '/v3/smtp/email')
      }
    }
  }
});
