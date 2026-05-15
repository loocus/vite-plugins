import type { ViteDevServer } from 'vite'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cssPropsPlugin } from '../plugin/index'

let workDir: string

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'css-props-plugin-'))
})

afterEach(() => {
  if (existsSync(workDir))
    rmSync(workDir, { recursive: true, force: true })
})

interface ConfigEnv {
  command: 'build' | 'serve'
  mode: string
}

async function runConfig(
  plugin: ReturnType<typeof cssPropsPlugin>,
  env: ConfigEnv,
  root: string,
): Promise<void> {
  const fn = plugin.config
  if (typeof fn !== 'function')
    return
  await fn.call(plugin as never, { root }, env)
}

function callConfigResolved(plugin: ReturnType<typeof cssPropsPlugin>, root: string): void {
  const fn = plugin.configResolved
  if (typeof fn !== 'function')
    return
  fn.call(plugin as never, { root } as never)
}

describe('cssPropsPlugin', () => {
  it('should expose name and resolveId for the JS virtual module', () => {
    // #given
    const plugin = cssPropsPlugin({ config: { colors: { primary: '#1677ff' } } })

    // #when
    const fn = plugin.resolveId
    const resolveJs = typeof fn === 'function' ? fn.call(plugin as never, 'virtual:css-props', undefined, {} as never) : undefined
    const resolveCss = typeof fn === 'function' ? fn.call(plugin as never, 'virtual:css-props.css', undefined, {} as never) : undefined

    // #then
    expect(plugin.name).toBe('vite-plugin-css-props')
    expect(resolveJs).toBe('\0virtual:css-props')
    expect(resolveCss).toBeNull()
  })

  it('should load virtual:css-props JS source after config hook initializes', async () => {
    // #given
    const plugin = cssPropsPlugin({ config: { colors: { primary: '#1677ff' } } })
    await runConfig(plugin, { command: 'serve', mode: 'dev' }, workDir)

    // #when
    const loadFn = plugin.load
    const result = typeof loadFn === 'function' ? loadFn.call(plugin as never, '\0virtual:css-props', {} as never) : null

    // #then
    expect(typeof result).toBe('string')
    expect(result).toContain('colorVar')
    expect(result).toContain('"var(--primary)"')
  })

  it('should write d.ts to the configured outFile after configResolved', async () => {
    // #given
    const plugin = cssPropsPlugin({
      config: { colors: { primary: '#1677ff' } },
      dts: { outFile: 'types/generated.d.ts' },
    })
    await runConfig(plugin, { command: 'build', mode: 'production' }, workDir)

    // #when
    callConfigResolved(plugin, workDir)

    // #then
    const dtsPath = resolve(workDir, 'types/generated.d.ts')
    expect(existsSync(dtsPath)).toBe(true)
    expect(readFileSync(dtsPath, 'utf8')).toContain('declare module \'virtual:css-props\'')
  })

  it('should not write d.ts when dts.enabled is false', async () => {
    // #given
    const plugin = cssPropsPlugin({
      config: { colors: { primary: '#1677ff' } },
      dts: { enabled: false },
    })
    await runConfig(plugin, { command: 'build', mode: 'production' }, workDir)

    // #when
    callConfigResolved(plugin, workDir)

    // #then
    expect(existsSync(resolve(workDir, 'src/types/css-props.d.ts'))).toBe(false)
  })

  it('should provide a sass importer through preprocessorOptions when called via config hook', async () => {
    // #given
    const plugin = cssPropsPlugin({ config: { colors: { primary: '#1677ff' } } })

    // #when
    const fn = plugin.config
    const returned = typeof fn === 'function'
      ? await fn.call(plugin as never, { root: workDir }, { command: 'serve', mode: 'dev' })
      : undefined

    // #then
    const importers = returned?.css?.preprocessorOptions?.scss?.importers
    expect(Array.isArray(importers)).toBe(true)
    expect(importers?.length).toBe(1)
  })

  it('should always inject inline style tag with :root.dark selector by default', async () => {
    // #given
    const plugin = cssPropsPlugin({
      config: { colors: { primary: '#1677ff', dark: { primary: '#4096ff' } } },
    })
    await runConfig(plugin, { command: 'build', mode: 'production' }, workDir)

    // #when
    const fn = plugin.transformIndexHtml
    const transformer = typeof fn === 'function' ? fn : null
    const html = transformer?.call(plugin as never, '<html><head></head><body></body></html>', {} as never)
    const result = typeof html === 'string' ? html : null

    // #then
    expect(result).not.toBeNull()
    expect(result).toContain('data-vite-plugin-css-props')
    expect(result).toContain('--primary: #1677ff')
    expect(result).toContain(':root.dark {')
  })

  it('should respect a custom darkSelector', async () => {
    // #given
    const plugin = cssPropsPlugin({
      config: { colors: { primary: '#1677ff', dark: { primary: '#4096ff' } } },
      darkSelector: '[data-theme="dark"]',
    })
    await runConfig(plugin, { command: 'build', mode: 'production' }, workDir)

    // #when
    const fn = plugin.transformIndexHtml
    const transformer = typeof fn === 'function' ? fn : null
    const html = transformer?.call(plugin as never, '<html><head></head><body></body></html>', {} as never)
    const result = typeof html === 'string' ? html : null

    // #then
    expect(result).toContain('[data-theme="dark"] {')
  })

  it('should reload config and invalidate virtual modules when watched config file changes', async () => {
    // #given
    const configPath = join(workDir, 'css.config.json')
    writeFileSync(configPath, JSON.stringify({ colors: { primary: '#1677ff' } }))
    const plugin = cssPropsPlugin({ configFile: 'css.config.json' })
    await runConfig(plugin, { command: 'serve', mode: 'dev' }, workDir)
    callConfigResolved(plugin, workDir)

    const handlers = new Map<string, (path: string) => Promise<void> | void>()
    const reloadModule = vi.fn()
    const wsSend = vi.fn()
    const fakeServer = {
      watcher: {
        add: vi.fn(),
        on: (event: string, cb: (path: string) => Promise<void> | void) => {
          handlers.set(event, cb)
        },
      },
      moduleGraph: {
        getModuleById: vi.fn((id: string) => ({ id })),
      },
      reloadModule,
      ws: { send: wsSend },
    }

    const fn = plugin.configureServer
    if (typeof fn !== 'function')
      throw new Error('configureServer hook missing')
    fn.call(plugin as never, fakeServer as unknown as ViteDevServer)

    // #when
    writeFileSync(configPath, JSON.stringify({ colors: { primary: '#000' } }))
    const handler = handlers.get('change')
    await handler?.(configPath)

    // #then
    expect(reloadModule).toHaveBeenCalledTimes(1)
    expect(wsSend).toHaveBeenCalledWith({ type: 'full-reload' })
    const dtsPath = resolve(workDir, 'src/types/css-props.d.ts')
    expect(readFileSync(dtsPath, 'utf8')).toContain('\'#000\'')
  })
})
