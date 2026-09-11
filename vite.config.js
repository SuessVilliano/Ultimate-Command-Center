import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Temporary self-destroying service worker: stale PWA caches were serving old
      // Command Center bundles after deploys. This unregisters the old worker so
      // production always loads the current Render build. Re-enable PWA caching
      // later only with explicit version/update handling.
      selfDestroying: true,
      registerType: 'autoUpdate',
      manifest: {
        name: 'LIV8 Command Center',
        short_name: 'LIV8',
        description: 'Your AI-powered command center for managing businesses, tasks, and GitHub projects',
        theme_color: '#7c3aed',
        background_color: '#050508',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ],
        categories: ['productivity', 'business', 'utilities'],
        shortcuts: [
          { name: 'Dashboard', url: '/?page=dashboard', description: 'Go to Dashboard' },
          { name: 'GitHub', url: '/?page=github', description: 'View GitHub Projects' },
          { name: 'Integrations', url: '/?page=integrations', description: 'Manage Integrations' }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    open: true
  }
})
