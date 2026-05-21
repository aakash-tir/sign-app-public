/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * onnxruntime-web's `new URL('...wasm', import.meta.url)` makes Vite emit its
 * ~26 MB WASM into dist, even though we load WASM from the CDN at runtime
 * (`ort.env.wasm.wasmPaths`). That dead file would exceed Cloudflare Pages'
 * 25 MB/file limit, so drop it from the bundle.
 */
function dropOrtWasm(): Plugin {
  return {
    name: 'drop-ort-wasm',
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (/ort-wasm.*\.wasm$/.test(fileName)) delete bundle[fileName]
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    dropOrtWasm(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Sign App — Learn ASL',
        short_name: 'Sign App',
        description:
          'Learn American Sign Language with on-device camera feedback.',
        theme_color: '#2563eb',
        background_color: '#0b1020',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the app shell + the bundled ONNX model + metadata so the
        // dynamic recognizer works offline after first load (FR-12). WASM is NOT
        // precached here — MediaPipe + onnxruntime-web WASM load from the CDN and
        // are runtime-cached below (the ORT WASM is ~26 MB, far past a sane
        // precache budget).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,onnx,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Runtime-cache the CDN-hosted recognition assets (MediaPipe WASM +
        // .task models, onnxruntime-web WASM) cache-first so they survive
        // going offline after the first successful load.
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) =>
              url.origin === 'https://cdn.jsdelivr.net',
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-runtime-assets',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }: { url: URL }) =>
              url.origin === 'https://storage.googleapis.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'mediapipe-models',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
