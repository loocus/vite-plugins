import type { OutputAsset, OutputBundle, OutputChunk } from 'rolldown'
import { Buffer } from 'node:buffer'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { analyzeBundle } from '../plugin/analyzer'

function createMockChunk(overrides: Partial<OutputChunk> = {}): OutputChunk {
  return {
    type: 'chunk',
    name: 'index',
    fileName: 'assets/index.js',
    code: 'console.log("hello")',
    modules: {
      'src/main.ts': { renderedLength: 20, code: null, renderedExports: [] },
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
    ...overrides,
  } as unknown as OutputChunk
}

function createMockAsset(overrides: Partial<OutputAsset> = {}): OutputAsset {
  return {
    type: 'asset',
    fileName: 'assets/style.css',
    source: 'body { margin: 0 }',
    names: ['style'],
    originalFileNames: [],
    needsCodeReference: false,
    ...overrides,
  } as unknown as OutputAsset
}

function createBundle(...items: (OutputChunk | OutputAsset)[]): OutputBundle {
  const bundle: OutputBundle = {}
  for (const item of items)
    bundle[item.fileName] = item
  return bundle
}

describe('analyzeBundle', () => {
  it('should analyze a single chunk bundle', () => {
    const chunk = createMockChunk()
    const bundle = createBundle(chunk)

    const result = analyzeBundle(bundle, false, '/', 500 * 1024)

    expect(result.root.id).toBe('root')
    expect(result.root.label).toBe('dist')
    expect(result.root.children).toHaveLength(1)

    // compressTree collapses assets/index.js (1 child: src) into src node
    const compressed = result.root.children![0]
    expect(compressed.id).toBe('src')
    expect(compressed.label).toBe('assets/index.js/src')
    expect(compressed.children).toHaveLength(1)

    const mainTs = compressed.children![0]
    expect(mainTs.id).toBe('src/main.ts')
    expect(mainTs.label).toBe('main.ts')
    expect(mainTs.size).toBe(20)
  })

  it('should filter out non-chunk assets', () => {
    const chunk = createMockChunk()
    const asset = createMockAsset()
    const bundle = createBundle(chunk, asset)

    const result = analyzeBundle(bundle, false, '/', 500 * 1024)

    expect(result.chunks).toHaveLength(1)
    expect(result.chunks[0].fileName).toBe('assets/index.js')
  })

  it('should compute correct byte sizes', () => {
    const code = '你好世界'
    const chunk = createMockChunk({ code })
    const bundle = createBundle(chunk)

    const result = analyzeBundle(bundle, false, '/', 500 * 1024)

    expect(result.chunks[0].size).toBe(Buffer.byteLength(code, 'utf8'))
    expect(result.chunks[0].gzipSize).toBeUndefined()
  })

  it('should compute gzip sizes when enabled', () => {
    const code = 'console.log("hello world")'
    const chunk = createMockChunk({ code })
    const bundle = createBundle(chunk)

    const result = analyzeBundle(bundle, true, '/', 500 * 1024)

    expect(result.chunks[0].gzipSize).toBe(gzipSync(code).byteLength)
    expect(result.meta.totalGzipSize).toBe(result.chunks[0].gzipSize)
  })

  it('should aggregate totalSize across multiple chunks', () => {
    const chunk1 = createMockChunk({ fileName: 'a.js', code: 'aaa' })
    const chunk2 = createMockChunk({ fileName: 'b.js', code: 'bbbbbb' })
    const bundle = createBundle(chunk1, chunk2)

    const result = analyzeBundle(bundle, false, '/', 500 * 1024)

    const expected = Buffer.byteLength('aaa', 'utf8') + Buffer.byteLength('bbbbbb', 'utf8')
    expect(result.meta.totalSize).toBe(expected)
    expect(result.meta.totalGzipSize).toBeUndefined()
  })

  it('should share module node references across chunks', () => {
    const sharedModules = {
      'src/shared.ts': { renderedLength: 10, code: null, renderedExports: [] },
    }
    const chunk1 = createMockChunk({
      fileName: 'a.js',
      modules: { ...sharedModules, 'src/a.ts': { renderedLength: 5, code: null, renderedExports: [] } },
    })
    const chunk2 = createMockChunk({
      fileName: 'b.js',
      modules: { ...sharedModules, 'src/b.ts': { renderedLength: 8, code: null, renderedExports: [] } },
    })
    const bundle = createBundle(chunk1, chunk2)

    const result = analyzeBundle(bundle, false, '/', 500 * 1024)

    // compressTree collapses chunk → src into one node (id: 'src')
    const srcDir1 = result.root.children![0]
    const srcDir2 = result.root.children![1]
    expect(srcDir1.id).toBe('src')
    expect(srcDir2.id).toBe('src')

    // shared.ts is marked as duplicated in both chunks
    const sharedNode = srcDir1.children!.find(n => n.id === 'src/shared.ts')
    expect(sharedNode).toBeDefined()
    expect(sharedNode!.size).toBe(10)
    expect(sharedNode!.duplicatedInChunks).toEqual(['a.js', 'b.js'])
  })

  it('should build nested directory structure for deep paths', () => {
    const chunk = createMockChunk({
      modules: {
        'src/utils/deep/helper.ts': { renderedLength: 15, code: null, renderedExports: [] },
      },
    })
    const bundle = createBundle(chunk)

    const result = analyzeBundle(bundle, false, '/', 500 * 1024)

    // compressTree collapses single-child chains:
    // assets/index.js → src → utils → deep → helper.ts
    // compresses to a single node with merged label
    const chunkNode = result.root.children![0]
    expect(chunkNode.label).toContain('src')
    expect(chunkNode.label).toContain('utils')
    expect(chunkNode.label).toContain('deep')

    // leaf is the helper.ts node
    const helperTs = chunkNode.children![0]
    expect(helperTs.id).toBe('src/utils/deep/helper.ts')
    expect(helperTs.label).toBe('helper.ts')
    expect(helperTs.size).toBe(15)
  })

  it('should set buildTime in meta', () => {
    const before = Date.now()
    const result = analyzeBundle(createBundle(createMockChunk()), false, '/', 500 * 1024)
    const after = Date.now()

    expect(result.meta.buildTime).toBeGreaterThanOrEqual(before)
    expect(result.meta.buildTime).toBeLessThanOrEqual(after)
  })

  it('should handle empty bundle', () => {
    const result = analyzeBundle({}, false, '/', 500 * 1024)

    expect(result.root.children).toEqual([])
    expect(result.chunks).toEqual([])
    expect(result.meta.totalSize).toBe(0)
  })
})
