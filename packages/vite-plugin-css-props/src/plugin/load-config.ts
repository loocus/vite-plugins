import type { Plugin as EsbuildPlugin } from 'esbuild'
import type { CssConfigInput, PluginOptions } from '../types'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const DEFAULT_CONFIG_NAMES = [
  'css.config.ts',
  'css.config.mts',
  'css.config.js',
  'css.config.mjs',
  'css.config.json',
]

const STUB_NAMESPACE = 'vite-plugin-css-props-stub'

const stubVitePluginCssProps: EsbuildPlugin = {
  name: 'vite-plugin-css-props-stub',
  setup(build) {
    build.onResolve({ filter: /^vite-plugin-css-props$/ }, () => ({
      path: 'vite-plugin-css-props',
      namespace: STUB_NAMESPACE,
    }))
    build.onLoad({ filter: /.*/, namespace: STUB_NAMESPACE }, () => ({
      contents: 'export const defineCssConfig = (config) => config;',
      loader: 'js',
    }))
  },
}

export interface LoadedConfig {
  config: CssConfigInput
  filePath: string | null
}

function isConfigObject(value: unknown): value is CssConfigInput {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unwrapDefault(mod: unknown): unknown {
  if (mod && typeof mod === 'object' && 'default' in mod)
    return (mod as { default: unknown }).default
  return mod
}

async function compileAndImport(absPath: string): Promise<unknown> {
  const dir = mkdtempSync(join(tmpdir(), 'vite-plugin-css-props-'))
  const outFile = join(dir, `css.config.${Date.now()}.mjs`)
  try {
    await build({
      entryPoints: [absPath],
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'node18',
      outfile: outFile,
      logLevel: 'silent',
      absWorkingDir: dirname(absPath),
      plugins: [stubVitePluginCssProps],
    })
    const mod = await import(`${pathToFileURL(outFile).href}?t=${Date.now()}`)
    return unwrapDefault(mod)
  }
  finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function loadJson(absPath: string): unknown {
  const raw = readFileSync(absPath, 'utf8')
  return JSON.parse(raw)
}

async function loadFromFile(absPath: string): Promise<CssConfigInput> {
  if (!existsSync(absPath))
    throw new Error(`[vite-plugin-css-props] config file not found: ${absPath}`)

  const value = absPath.endsWith('.json')
    ? loadJson(absPath)
    : await compileAndImport(absPath)

  if (!isConfigObject(value))
    throw new Error(`[vite-plugin-css-props] config at ${absPath} must export a CssConfig object`)

  return value
}

export function locateDefaultConfig(root: string): string | null {
  for (const name of DEFAULT_CONFIG_NAMES) {
    const abs = resolve(root, name)
    if (existsSync(abs))
      return abs
  }
  return null
}

export async function loadCssConfig(
  options: PluginOptions,
  root: string,
): Promise<LoadedConfig> {
  if (options.config && typeof options.config !== 'string')
    return { config: options.config, filePath: null }

  const explicitPath = (typeof options.config === 'string' ? options.config : undefined)
    ?? options.configFile

  if (explicitPath) {
    const abs = resolve(root, explicitPath)
    const config = await loadFromFile(abs)
    return { config, filePath: abs }
  }

  const discovered = locateDefaultConfig(root)
  if (discovered) {
    const config = await loadFromFile(discovered)
    return { config, filePath: discovered }
  }

  return { config: {}, filePath: null }
}

export function writeIfChanged(absPath: string, content: string): boolean {
  if (existsSync(absPath)) {
    const existing = readFileSync(absPath, 'utf8')
    if (existing === content)
      return false
  }
  writeFileSync(absPath, content, 'utf8')
  return true
}
