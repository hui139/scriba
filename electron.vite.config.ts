import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    // Bind the dev server to IPv4 explicitly. With the default (`localhost`) Vite
    // binds to whatever name resolution returns first, which on Windows is often
    // only `::1`, while Chromium may try `127.0.0.1` first. That mismatch makes the
    // renderer fail to load now and then, and since `ready-to-show` never fires the
    // app then runs without ever showing a window.
    server: { host: '127.0.0.1' },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
})
