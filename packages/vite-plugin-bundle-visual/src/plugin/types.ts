export interface ModuleNode {
  id: string
  label: string
  size: number
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
    buildTime: number
    /** Chunk size warning threshold in bytes. Chunks exceeding this are highlighted. */
    chunkSizeWarningLimit: number
  }
}

export interface BundleVisualOptions {
  /** Output filename for the report. Default: 'bundle-visual.html' */
  filename?: string
  /** Automatically open the report in the browser after build. Default: false */
  open?: boolean
  /** Include gzip size analysis. Default: false */
  gzip?: boolean
  /** Output directory for the report. Defaults to Vite's build.outDir */
  outDir?: string
  /**
   * Chunk size warning threshold in bytes.
   * Defaults to Vite's build.chunkSizeWarningLimit (converted from KB to bytes).
   * Set explicitly to override.
   */
  chunkSizeWarningLimit?: number
}
