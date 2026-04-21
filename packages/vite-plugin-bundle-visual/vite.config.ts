import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/plugin/index.ts'),
      formats: ['es', 'cjs'],
      fileName: format => `index.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      external: [
        'vite',
        /^node:/,
        'fs',
        'path',
        'url',
        'zlib',
        'child_process',
        'buffer',
        'process',
      ],
      output: {
        exports: 'named',
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
})
