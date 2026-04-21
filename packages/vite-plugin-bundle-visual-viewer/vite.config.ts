import type { OutputAsset, OutputChunk } from 'rolldown'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'

const DEV_DATA_SCRIPT_RE = /<script id="__bundle-data-dev__">[\s\S]*?<\/script>/
const PLACEHOLDER = '__BUNDLE_DATA_PLACEHOLDER__'

function inlineSingleFilePlugin(): Plugin {
  return {
    name: 'bundle-visual:inline-single-file',
    enforce: 'post',
    generateBundle(_, bundle) {
      const htmlAsset = Object.values(bundle).find(
        (f): f is OutputAsset => f.type === 'asset' && f.fileName.endsWith('.html'),
      )
      if (!htmlAsset || typeof htmlAsset.source !== 'string')
        return

      let html = htmlAsset.source

      // Inline each CSS asset by matching its href in link tags
      html = html.replace(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi, (match) => {
        const hrefMatch = /href=["']([^"']+)["']/.exec(match)
        if (!hrefMatch)
          return match
        const key = hrefMatch[1].replace(/^\.?\//, '')
        const asset = bundle[key] as OutputAsset | undefined
        if (!asset || typeof asset.source !== 'string')
          return match
        delete bundle[key]
        return `<style>${asset.source}</style>`
      })

      // Inline each JS chunk by matching its src in script tags
      html = html.replace(/<script([^>]*)src=["']([^"']+)["'][^>]*><\/script>/gi, (match, attrs: string, src: string) => {
        const key = src.replace(/^\.?\//, '')
        const chunk = bundle[key] as OutputChunk | undefined
        if (!chunk)
          return match
        delete bundle[key]
        const cleanAttrs = attrs.replace(/\s+src=["'][^"']*["']/, '').trim()
        return cleanAttrs ? `<script ${cleanAttrs}>${chunk.code}</script>` : `<script type="module">${chunk.code}</script>`
      })

      // Replace dev mock data script with runtime placeholder
      html = html.replace(
        DEV_DATA_SCRIPT_RE,
        `<script>window.__BUNDLE_DATA__ = ${PLACEHOLDER}</script>`,
      )

      htmlAsset.source = html
    },
  }
}

export default defineConfig({
  base: './',
  build: {
    cssCodeSplit: false,
    cssMinify: true,
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [inlineSingleFilePlugin()],
})
