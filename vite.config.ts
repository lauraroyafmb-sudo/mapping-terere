import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  base: '/mapping-terere/',
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'not IE 11', 'Android >= 5', 'iOS >= 10'],
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo-terere.png', 'icon-192x192.png', 'icon-512x512.png'],
      manifest: {
        name: 'Mapping Terere',
        short_name: 'Terere',
        description: 'Herramienta de mapeo topográfico profesional',
        theme_color: '#22C55E',
        background_color: '#f7f9fb',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/mapping-terere/',
        start_url: '/mapping-terere/',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'logo-terere.png',
            sizes: '1024x1024',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  build: {
    target: 'es2015',
    minify: 'terser',
    cssCodeSplit: true,
    rollupOptions: {
    }
  }
})
