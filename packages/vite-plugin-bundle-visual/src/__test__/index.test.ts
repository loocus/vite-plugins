import type { OutputBundle } from 'rolldown'
import type { Plugin, ResolvedConfig } from 'vite'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bundleVisual } from '../plugin/index'

vi.mock('vite-plugin-bundle-visual-viewer/template?raw', () => ({
  default: '<html><script>window.__BUNDLE_DATA__ = __BUNDLE_DATA_PLACEHOLDER__</script></html>',
}))

vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}))

function createMockConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    root: tmpdir(),
    build: { outDir: 'dist' },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  } as unknown as ResolvedConfig
}

function callHook(plugin: Plugin, hook: 'configResolved', config: ResolvedConfig): void
function callHook(plugin: Plugin, hook: 'generateBundle', options: Record<string, never>, bundle: OutputBundle): void
function callHook(plugin: Plugin, hook: string, ...args: unknown[]): void {
  const fn = plugin[hook as keyof Plugin]
  if (typeof fn === 'function')
    fn.call(plugin, ...args)
}

function createMockBundle(): OutputBundle {
  return {
    'assets/index.js': {
      type: 'chunk',
      name: 'index',
      fileName: 'assets/index.js',
      code: 'console.log("test")',
      modules: {
        'src/main.ts': { renderedLength: 19, code: null, renderedExports: [] },
      },
      isEntry: true,
      isDynamicEntry: false,
      exports: [],
      facadeModuleId: null,
      moduleIds: ['src/main.ts'],
      imports: [],
      dynamicImports: [],
      map: null,
      sourcemapFileName: null,
      preliminaryFileName: 'assets/index.js',
    } as unknown as OutputBundle[string],
  }
}

describe('bundleVisual', () => {
  let testDir: string

  beforeEach(() => {
    testDir = resolve(tmpdir(), `bundle-visual-test-${Date.now()}`)
  })

  afterEach(() => {
    if (existsSync(testDir))
      rmSync(testDir, { recursive: true })
  })

  it('should return a plugin with correct name', () => {
    const plugin = bundleVisual()
    expect(plugin.name).toBe('vite-plugin-bundle-visual')
  })

  it('should only apply during build', () => {
    const plugin = bundleVisual()
    expect(plugin.apply).toBe('build')
  })

  it('should write report file in generateBundle', () => {
    const plugin = bundleVisual({ filename: 'report.html' })
    const config = createMockConfig({ root: testDir })

    callHook(plugin, 'configResolved', config)
    callHook(plugin, 'generateBundle', {}, createMockBundle())

    const outputPath = resolve(testDir, 'dist', 'report.html')
    expect(existsSync(outputPath)).toBe(true)

    const content = readFileSync(outputPath, 'utf8')
    expect(content).toContain('"id":"root"')
    expect(content).not.toContain('__BUNDLE_DATA_PLACEHOLDER__')
  })

  it('should use custom outDir when specified', () => {
    const plugin = bundleVisual({ outDir: 'custom-out' })
    const config = createMockConfig({ root: testDir })

    callHook(plugin, 'configResolved', config)
    callHook(plugin, 'generateBundle', {}, createMockBundle())

    const outputPath = resolve(testDir, 'custom-out', 'bundle-visual.html')
    expect(existsSync(outputPath)).toBe(true)
  })

  it('should open browser when open option is true', async () => {
    const { exec } = await import('node:child_process')
    const plugin = bundleVisual({ open: true })
    const config = createMockConfig({ root: testDir })

    callHook(plugin, 'configResolved', config)
    callHook(plugin, 'generateBundle', {}, createMockBundle())

    expect(exec).toHaveBeenCalled()
  })

  it('should not open browser by default', async () => {
    const { exec } = await import('node:child_process')
    vi.mocked(exec).mockClear()

    const plugin = bundleVisual()
    const config = createMockConfig({ root: testDir })

    callHook(plugin, 'configResolved', config)
    callHook(plugin, 'generateBundle', {}, createMockBundle())

    expect(exec).not.toHaveBeenCalled()
  })

  it('should use default filename when not specified', () => {
    const plugin = bundleVisual()
    const config = createMockConfig({ root: testDir })

    callHook(plugin, 'configResolved', config)
    callHook(plugin, 'generateBundle', {}, createMockBundle())

    expect(existsSync(resolve(testDir, 'dist', 'bundle-visual.html'))).toBe(true)
  })
})
