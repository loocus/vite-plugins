import type { Plugin, ViteDevServer } from 'vite'
import type { NormalizedCssConfig, PluginOptions } from '../types'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { generateCss } from './codegen-css'
import { generateDts } from './codegen-dts'
import { generateJs } from './codegen-js'
import { loadCssConfig, writeIfChanged } from './load-config'
import { normalizeCssConfig } from './normalize'
import { createSassImporter } from './sass-importer'

const VIRTUAL_JS_ID = 'virtual:css-props'
const RESOLVED_JS_ID = `\0${VIRTUAL_JS_ID}`

const DEFAULT_DARK_SELECTOR = ':root.dark'
const DEFAULT_DTS_OUT = 'src/types/css-props.d.ts'

function resolveDtsPath(options: PluginOptions, root: string): string {
  const outFile = options.dts?.outFile ?? DEFAULT_DTS_OUT
  return resolve(root, outFile)
}

function ensureDirFor(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true })
}

function writeDts(config: NormalizedCssConfig, options: PluginOptions, root: string): void {
  if (options.dts?.enabled === false)
    return
  const absPath = resolveDtsPath(options, root)
  ensureDirFor(absPath)
  writeIfChanged(absPath, generateDts(config))
}

function invalidateVirtualModule(server: ViteDevServer, id: string): void {
  const mod = server.moduleGraph.getModuleById(id)
  if (mod)
    void server.reloadModule(mod)
}

export function cssPropsPlugin(options: PluginOptions = {}): Plugin {
  let normalized: NormalizedCssConfig | null = null
  let configFilePath: string | null = null
  let projectRoot = process.cwd()
  const darkSelector = options.darkSelector ?? DEFAULT_DARK_SELECTOR
  const scssStrict = options.scss?.strict ?? true

  async function reload(root: string): Promise<void> {
    const loaded = await loadCssConfig(options, root)
    normalized = normalizeCssConfig(loaded.config, options.prefix ?? '')
    configFilePath = loaded.filePath
  }

  return {
    name: 'vite-plugin-css-props',

    async config(userConfig) {
      const root = userConfig.root ?? process.cwd()
      projectRoot = root
      await reload(root)
      return {
        css: {
          preprocessorOptions: {
            scss: {
              importers: [createSassImporter(() => normalized, scssStrict)],
            },
          },
        },
      }
    },

    configResolved(config) {
      projectRoot = config.root
      if (normalized)
        writeDts(normalized, options, projectRoot)
    },

    resolveId(id) {
      if (id === VIRTUAL_JS_ID)
        return RESOLVED_JS_ID
      return null
    },

    load(id) {
      if (!normalized)
        return null
      if (id === RESOLVED_JS_ID)
        return generateJs(normalized)
      return null
    },

    transformIndexHtml(html) {
      if (!normalized)
        return html
      const css = generateCss(normalized, darkSelector)
      if (css.length === 0)
        return html
      const tag = `<style data-vite-plugin-css-props>${css}</style>`
      return html.includes('</head>')
        ? html.replace('</head>', `${tag}</head>`)
        : `${tag}${html}`
    },

    configureServer(server) {
      if (!configFilePath)
        return
      server.watcher.add(configFilePath)
      server.watcher.on('change', async (changedPath) => {
        if (configFilePath === null || changedPath !== configFilePath)
          return
        await reload(projectRoot)
        if (normalized)
          writeDts(normalized, options, projectRoot)
        invalidateVirtualModule(server, RESOLVED_JS_ID)
        server.ws.send({ type: 'full-reload' })
      })
    },
  }
}

export default cssPropsPlugin
