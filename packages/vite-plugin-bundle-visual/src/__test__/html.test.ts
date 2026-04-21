import { describe, expect, it, vi } from 'vitest'

vi.mock('vite-plugin-bundle-visual-viewer/template?raw', () => ({
  default: '<html><script>window.__BUNDLE_DATA__ = __BUNDLE_DATA_PLACEHOLDER__</script></html>',
}))

const { injectBundleData } = await import('../plugin/html')

describe('injectBundleData', () => {
  it('should replace placeholder with JSON data', () => {
    const data = {
      root: { id: 'root', label: 'dist', size: 0, children: [] },
      chunks: [],
      meta: { totalSize: 100, buildTime: 1000, chunkSizeWarningLimit: 512000 },
    }

    const result = injectBundleData(data)

    expect(result).toContain(JSON.stringify(data))
    expect(result).not.toContain('__BUNDLE_DATA_PLACEHOLDER__')
  })

  it('should produce valid HTML with embedded JSON', () => {
    const data = {
      root: { id: 'root', label: 'dist', size: 0 },
      chunks: [{ id: 'index', fileName: 'index.js', size: 50, moduleIds: ['a.ts'] }],
      meta: { totalSize: 50, buildTime: 1000, chunkSizeWarningLimit: 512000 },
    }

    const result = injectBundleData(data)

    expect(result).toContain('<html')
    expect(result).toContain('</html>')
    expect(result).toContain('<script>')
  })

  it('should handle special characters in module ids', () => {
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

    const result = injectBundleData(data)

    expect(result).toContain(JSON.stringify(data))
  })
})
