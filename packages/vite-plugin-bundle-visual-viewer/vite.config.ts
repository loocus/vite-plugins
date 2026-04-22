import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

const PLACEHOLDER = '__BUNDLE_DATA_PLACEHOLDER__'

const DEV_MOCK_DATA = {
  root: {
    id: 'root',
    label: 'dist',
    size: 0,
    children: [
      {
        id: 'node_modules/vue',
        label: 'vue',
        size: 0,
        children: [
          { id: 'node_modules/vue/dist/vue.runtime.esm-bundler.js', label: 'vue.runtime', size: 102400 },
          { id: 'node_modules/@vue/reactivity', label: '@vue/reactivity', size: 40960 },
        ],
      },
      {
        id: 'src',
        label: 'src',
        size: 0,
        children: [
          { id: 'src/main.ts', label: 'main.ts', size: 2048 },
          { id: 'src/App.vue', label: 'App.vue', size: 8192 },
          { id: 'src/components/Button.vue', label: 'Button.vue', size: 4096 },
        ],
      },
    ],
  },
  chunks: [],
  meta: { totalSize: 157696, buildTime: Date.now(), chunkSizeWarningLimit: 512000 },
}

export default defineConfig(({ command }) => {
  const isDev = command === 'serve'

  return {
    base: './',
    build: {
      cssCodeSplit: false,
      cssMinify: true,
      outDir: 'dist',
      emptyOutDir: true,
    },
    define: {
      __BUNDLE_DATA__: isDev ? JSON.stringify(DEV_MOCK_DATA) : PLACEHOLDER,
    },
    plugins: [
      !isDev && viteSingleFile(),
    ],
  }
})
