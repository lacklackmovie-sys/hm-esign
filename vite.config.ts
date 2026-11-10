import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.BASE_PATH ?? '/hm-esign/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/*.png', 'mark.svg', 'logo.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,mjs,png,svg,webmanifest}'],
        globIgnores: ['pdfjs/**', 'og.png'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          { urlPattern: ({ url }) => url.pathname.includes('/pdfjs/') || /\.woff2$/.test(url.pathname), handler: 'CacheFirst', options: { cacheName: 'static-assets', expiration: { maxEntries: 200 } } },
        ],
      },
      manifest: {
        name: '허니미디어 전자계약서 · HONEY MEDIA',
        short_name: 'HM 전자계약',
        description: '허니미디어 모바일 전자계약(전자서명) 관리자',
        lang: 'ko',
        start_url: base,
        scope: base,
        id: base,
        display: 'standalone',
        background_color: '#0e0e0d',
        theme_color: '#0e0e0d',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  build: { target: 'es2020', chunkSizeWarningLimit: 2500 },
})
