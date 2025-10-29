import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true,
    host: true, // Allow external access
    cors: true, // Enable CORS
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // PWA build optimizations
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'react'], // if you add any frameworks later
          utils: ['./src/utils/auth.js', './src/utils/view-transition.js']
        }
      }
    }
  },
  // PWA specific configurations
  define: {
    '__DEV__': JSON.stringify(process.env.NODE_ENV !== 'production')
  },
  // Ensure proper MIME types for PWA
  plugins: [
    // Basic HTML plugin (you can add more plugins later)
    {
      name: 'pwa-config',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Ensure service worker is served with correct headers
          if (req.url === '/sw.js') {
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Service-Worker-Allowed', '/');
          }
          next();
        });
      }
    }
  ]
});