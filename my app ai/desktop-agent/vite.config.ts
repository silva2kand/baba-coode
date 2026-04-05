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
          delete process.env.ELECTRON_RUN_AS_NODE
          args.startup()
        },
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: [
                'playwright',
                'playwright-core',
                'chromium-bidi',
                'chromium-bidi/lib/cjs/bidiMapper/BidiMapper',
                'chromium-bidi/lib/cjs/cdp/CdpConnection',
                '@nut-tree-fork/nut-js',
                'punycode',
                'ws',
              ],
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
            // vite-plugin-electron still types this build block narrowly, but Vite 8 accepts codeSplitting here.
            // @ts-expect-error Supported at runtime; plugin typings have not caught up yet.
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
