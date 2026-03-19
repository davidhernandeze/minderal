import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => ['countdown-timer'].includes(tag)
        }
      }
    }),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 4000000
      },
      manifest: {
        name: 'Minderal',
        short_name: 'minderal',
        description: 'Mind mapping tool',
        theme_color: '#1f2937',
        background_color: '#f8fff8',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        share_target: {
          action: '/shared-content-receiver/',
          method: 'GET',
          params: {
            title: 'name',
            text: 'description',
            url: 'link'
          }
        }
      }
    }),
    // sentryVitePlugin({
    //   org: 'coworg',
    //   project: 'minderal',
    //   authToken: process.env.SENTRY_AUTH_TOKEN
    // })
  ],

  define: {
    global: 'window'
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target: process.env.TAURI_ENV_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    // don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    // produce sourcemaps for debug builds
    sourcemap: true
  }
})
