export interface ModuleNode {
  id: string
  label: string
  /** Original size in bytes */
  size: number
  /** Gzip size in bytes (optional, populated when gzip analysis is enabled) */
  gzipSize?: number
  children?: ModuleNode[]
  /** Chunk file names this module appears in (only set when count > 1) */
  duplicatedInChunks?: string[]
}

export interface ChunkInfo {
  id: string
  fileName: string
  size: number
  gzipSize?: number
  moduleIds: string[]
}

export interface BundleData {
  root: ModuleNode
  chunks: ChunkInfo[]
  meta: {
    totalSize: number
    totalGzipSize?: number
    /** Unix timestamp (ms) */
    buildTime: number
    /** Chunk size warning threshold in bytes */
    chunkSizeWarningLimit: number
  }
}
