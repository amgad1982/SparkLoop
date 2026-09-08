import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'client-error-logger',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/__client_error' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => {
              console.error('\n🔴 [BROWSER CLIENT ERROR] 🔴\n', body, '\n');
              try {
                fs.writeFileSync(
                  '/Users/amgad/.gemini/antigravity-ide/brain/b7cc83a1-976f-4a3b-af37-ad46d2b1593f/scratch/browser_error.log',
                  body
                );
              } catch (_) {}
              res.statusCode = 200;
              res.end('ok');
            });
            return;
          }
          next();
        });
      },
    },
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5195',
        changeOrigin: true,
      },
    },
  },
});
