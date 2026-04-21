import type { OutputAsset, OutputBundle, OutputChunk } from 'rolldown'
import type { BundleData, ChunkInfo, ModuleNode } from './types'
import { Buffer } from 'node:buffer'
import { gzipSync } from 'node:zlib'

function isOutputChunk(output: OutputChunk | OutputAsset): output is OutputChunk {
  return output.type === 'chunk'
}

/**
 * Normalize a raw module ID from Rolldown:
 * - Returns null for virtual modules (Rollup \x00 convention)
 * - Strips the project root prefix from absolute paths
 * - Normalizes backslashes to forward slashes
 */
function normalizeModuleId(rawId: string, projectRoot: string): string | null {
  if (rawId.startsWith('\x00'))
    return null

  const id = rawId.replace(/\\/g, '/')
  const root = projectRoot.replace(/\\/g, '/').replace(/\/$/, '')
  const prefix = `${root}/`

  return id.startsWith(prefix) ? id.slice(prefix.length) : id
}

/**
 * Build a map of normalized module ID → chunk file names it appears in.
 * Only entries with 2+ chunks are meaningful for duplicate detection.
 */
function buildDuplicateMap(
  chunks: OutputChunk[],
  projectRoot: string,
): Map<string, string[]> {
  const moduleToChunks = new Map<string, string[]>()

  for (const chunk of chunks) {
    for (const rawId of Object.keys(chunk.modules)) {
      const id = normalizeModuleId(rawId, projectRoot)
      if (id === null)
        continue
      const list = moduleToChunks.get(id) ?? []
      list.push(chunk.fileName)
      moduleToChunks.set(id, list)
    }
  }

  return new Map([...moduleToChunks.entries()].filter(([, list]) => list.length > 1))
}

function getOrCreateDir(nodeMap: Map<string, ModuleNode>, dirPath: string): ModuleNode {
  const existing = nodeMap.get(dirPath)
  if (existing)
    return existing

  const node: ModuleNode = {
    id: dirPath,
    label: dirPath.split('/').pop() ?? dirPath,
    size: 0,
    children: [],
  }
  nodeMap.set(dirPath, node)
  return node
}

function insertModule(
  nodeMap: Map<string, ModuleNode>,
  moduleId: string,
  size: number,
  gzipSize: number | undefined,
  duplicatedInChunks: string[] | undefined,
): ModuleNode {
  const existing = nodeMap.get(moduleId)
  if (existing)
    return existing

  const leaf: ModuleNode = {
    id: moduleId,
    label: moduleId.split('/').pop() ?? moduleId,
    size,
    gzipSize,
    duplicatedInChunks,
  }
  nodeMap.set(moduleId, leaf)

  const parts = moduleId.split('/')
  if (parts.length <= 1)
    return leaf

  const parentPath = parts.slice(0, -1).join('/')
  const parentDir = getOrCreateDir(nodeMap, parentPath)
  parentDir.children!.push(leaf)

  for (let i = parts.length - 2; i >= 1; i--) {
    const currentPath = parts.slice(0, i + 1).join('/')
    const parentOfCurrentPath = parts.slice(0, i).join('/')
    const current = nodeMap.get(currentPath)!
    const parent = getOrCreateDir(nodeMap, parentOfCurrentPath)
    if (!parent.children!.includes(current))
      parent.children!.push(current)
  }

  return leaf
}

function compressTree(node: ModuleNode): ModuleNode {
  if (!node.children?.length)
    return node

  const children = node.children.map(compressTree)

  if (children.length === 1 && children[0].children?.length) {
    const only = children[0]
    return compressTree({
      ...only,
      label: `${node.label}/${only.label}`,
    })
  }

  return { ...node, children }
}

function buildChunkTree(
  chunk: OutputChunk,
  projectRoot: string,
  duplicateMap: Map<string, string[]>,
  gzipRatio: number | undefined,
): ModuleNode {
  const nodeMap = new Map<string, ModuleNode>()

  for (const [rawId, moduleInfo] of Object.entries(chunk.modules)) {
    const moduleId = normalizeModuleId(rawId, projectRoot)
    if (moduleId === null)
      continue

    const rawSize = moduleInfo.renderedLength ?? 0
    const gzipSize = gzipRatio !== undefined ? Math.round(rawSize * gzipRatio) : undefined
    const duplicatedInChunks = duplicateMap.get(moduleId)

    insertModule(nodeMap, moduleId, rawSize, gzipSize, duplicatedInChunks)
  }

  const topLevelKeys = new Set<string>()
  for (const rawId of Object.keys(chunk.modules)) {
    const moduleId = normalizeModuleId(rawId, projectRoot)
    if (moduleId === null)
      continue
    topLevelKeys.add(moduleId.split('/')[0])
  }

  const rawChunk: ModuleNode = {
    id: chunk.fileName,
    label: chunk.fileName,
    size: 0,
    children: [...topLevelKeys]
      .map(id => nodeMap.get(id))
      .filter((n): n is ModuleNode => n !== undefined),
  }

  return compressTree(rawChunk)
}

function buildModuleTree(
  chunks: OutputChunk[],
  projectRoot: string,
  chunkGzipSizes: Map<string, number>,
): ModuleNode {
  const duplicateMap = buildDuplicateMap(chunks, projectRoot)

  const children = chunks.map((chunk) => {
    const rawSize = Buffer.byteLength(chunk.code, 'utf8')
    const gzipSize = chunkGzipSizes.get(chunk.fileName)
    const gzipRatio = gzipSize !== undefined && rawSize > 0 ? gzipSize / rawSize : undefined
    return buildChunkTree(chunk, projectRoot, duplicateMap, gzipRatio)
  })

  return { id: 'root', label: 'dist', size: 0, children }
}

export function analyzeBundle(
  bundle: OutputBundle,
  enableGzip: boolean,
  projectRoot: string,
  chunkSizeWarningLimit: number,
): BundleData {
  const chunks = Object.values(bundle).filter(isOutputChunk)

  const chunkGzipSizes = new Map<string, number>()
  const chunkInfos: ChunkInfo[] = chunks.map((chunk) => {
    const code = chunk.code
    const size = Buffer.byteLength(code, 'utf8')
    const gzipSize = enableGzip ? gzipSync(code).byteLength : undefined
    if (gzipSize !== undefined)
      chunkGzipSizes.set(chunk.fileName, gzipSize)

    return {
      id: chunk.name,
      fileName: chunk.fileName,
      size,
      gzipSize,
      moduleIds: Object.keys(chunk.modules),
    }
  })

  const totalSize = chunkInfos.reduce((sum, c) => sum + c.size, 0)
  const totalGzipSize = enableGzip
    ? chunkInfos.reduce((sum, c) => sum + (c.gzipSize ?? 0), 0)
    : undefined

  return {
    root: buildModuleTree(chunks, projectRoot, chunkGzipSizes),
    chunks: chunkInfos,
    meta: { totalSize, totalGzipSize, buildTime: Date.now(), chunkSizeWarningLimit },
  }
}
