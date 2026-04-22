import { describe, expect, it, vi } from 'vitest'

const MOCK_TEMPLATE = '<html><head><script>window.__BUNDLE_DATA__ = __BUNDLE_DATA_PLACEHOLDER__</script></head></html>'

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(() => MOCK_TEMPLATE),
}))

vi.mock('node:module', () => ({
  createRequire: vi.fn(() => ({
    resolve: vi.fn(() => '/mock/path/index.html'),
  })),
}))

const { injectBundleData } = await import('../plugin/html')

describe('injectBundleData', () => {
  it('should replace placeholder with JSON data', () => {
    // #given
    const data = {
      root: { id: 'root', label: 'dist', size: 0, children: [] },
      chunks: [],
      meta: { totalSize: 100, buildTime: 1000, chunkSizeWarningLimit: 512000 },
    }

    // #when
    const result = injectBundleData(data)

    // #then
    expect(result).toContain(JSON.stringify(data))
    expect(result).not.toContain('__BUNDLE_DATA_PLACEHOLDER__')
  })

  it('should produce valid HTML with embedded JSON', () => {
    // #given
    const data = {
      root: { id: 'root', label: 'dist', size: 0 },
      chunks: [{ id: 'index', fileName: 'index.js', size: 50, moduleIds: ['a.ts'] }],
      meta: { totalSize: 50, buildTime: 1000, chunkSizeWarningLimit: 512000 },
    }

    // #when
    const result = injectBundleData(data)

    // #then
    expect(result).toContain('<html')
    expect(result).toContain('</html>')
    expect(result).toContain('<script>')
  })

  it('should handle special characters in module ids', () => {
    // #given
    const data = {
      root: {
        id: 'root',
        label: 'dist',
        size: 0,
        children: [
          { id: 'src/utils/helper<T>.ts', label: 'helper<T>.ts', size: 10 },
        ],
      },
      chunks: [],
      meta: { totalSize: 10, buildTime: 1000, chunkSizeWarningLimit: 512000 },
    }

    // #when
    const result = injectBundleData(data)

    // #then
    expect(result).toContain(JSON.stringify(data))
  })
})
