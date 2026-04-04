import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...electron([
      {
        entry: 'electron/main/index.ts',
        onstart(args) {
          args.startup()
        },
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              output: {
                entryFileNames: 'index.mjs',
              },
            },
          },
        },
      },
      {
        entry: 'electron/preload/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            codeSplitting: false,
            rollupOptions: {
              output: {
                entryFileNames: 'index.mjs',
              },
            },
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 7777,
  },
})
