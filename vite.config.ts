import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import path from 'path'

export default defineConfig({
  base: './',
  plugins: [uni()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  build: {
    target: 'es2015',
    cssCodeSplit: true,
    crossorigin: false,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  }
})
