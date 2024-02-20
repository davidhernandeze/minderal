import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dynamicImport from 'vite-plugin-dynamic-import'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), dynamicImport()],
  define: {
    global: 'window'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
