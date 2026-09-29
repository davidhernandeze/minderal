import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // Listen on every interface so a phone on the same network can reach the
    // dev server by this machine's LAN address.
    host: true
  },
  resolve: {
    alias: {
      '@minderal/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
      // core imports `pouchdb`, whose main entry is the Node build. Its CJS
      // interop breaks under Vite ("Class extends value [object Object]").
      // pouchdb-browser is the same API with the idb + http adapters.
      pouchdb: 'pouchdb-browser',
      // PouchDB does `class X extends require('events').EventEmitter`. Without
      // the npm `events` shim installed, that resolves to a Node builtin stub
      // and the class extends an object instead of a constructor.
      events: 'events'
    },
    dedupe: ['pouchdb', 'pouchdb-browser']
  },
  optimizeDeps: {
    include: ['pouchdb-browser', 'pouchdb-find', 'pouchdb-all-dbs', 'events']
  },
  define: {
    global: 'globalThis'
  }
})
