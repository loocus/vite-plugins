import type { Plugin, ResolvedConfig } from 'vite'
import type { BundleVisualOptions } from './types'
import { exec } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { analyzeBundle } from './analyzer'
import { injectBundleData } from './html'

export type { BundleVisualOptions } from './types'

export function bundleVisual(options: BundleVisualOptions = {}): Plugin {
  const {
    filename = 'bundle-visual.html',
    open = false,
    gzip = false,
  } = options

  let resolvedConfig: ResolvedConfig

  return {
    name: 'vite-plugin-bundle-visual',
    apply: 'build',

    configResolved(config) {
      resolvedConfig = config
    },

    generateBundle(_outputOptions, bundle) {
      const outDir = options.outDir ?? resolvedConfig.build.outDir
      const outputPath = resolve(resolvedConfig.root, outDir, filename)

      // chunkSizeWarningLimit: 优先用户手动指定（bytes），否则读取 Vite 配置（KB → bytes）
      const chunkSizeWarningLimit = options.chunkSizeWarningLimit
        ?? (resolvedConfig.build.chunkSizeWarningLimit ?? 500) * 1024

      const data = analyzeBundle(bundle, gzip, resolvedConfig.root, chunkSizeWarningLimit)
      const html = injectBundleData(data)

      mkdirSync(resolve(resolvedConfig.root, outDir), { recursive: true })
      writeFileSync(outputPath, html, 'utf8')

      resolvedConfig.logger.info(
        `\n  bundle-visual report → ${outputPath}`,
      )

      if (open) {
        const cmd = process.platform === 'win32'
          ? `start "" "${outputPath}"`
          : process.platform === 'darwin'
            ? `open "${outputPath}"`
            : `xdg-open "${outputPath}"`
        exec(cmd)
      }
    },
  }
}

export default bundleVisual
