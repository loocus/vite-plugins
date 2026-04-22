# vite-plugin-bundle-visual-viewer

[中文文档](./README.zh-CN.md)

The interactive treemap viewer for `vite-plugin-bundle-visual`. Renders bundle composition as a zoomable, pannable treemap using D3.

The build output is a **self-contained single-file HTML** with all JS and CSS inlined. It runs standalone with no external dependencies — just replace the placeholder `__BUNDLE_DATA_PLACEHOLDER__` with your bundle data and open it in a browser.

## Data Format

The injected data must conform to the following structure:

```typescript
interface BundleData {
  root: ModuleNode // module tree root
  chunks: ChunkInfo[] // chunk list
  meta: {
    totalSize: number // total size in bytes
    totalGzipSize?: number // total gzip size in bytes (optional)
    buildTime: number // build timestamp (ms)
    chunkSizeWarningLimit: number // chunk size warning threshold in bytes
  }
}

interface ModuleNode {
  id: string
  label: string
  size: number // original size in bytes
  gzipSize?: number
  children?: ModuleNode[]
  duplicatedInChunks?: string[] // set when module appears in multiple chunks
}

interface ChunkInfo {
  id: string
  fileName: string
  size: number
  gzipSize?: number
  moduleIds: string[]
}
```

## Usage

### Option 1: Runtime file read (recommended)

Suitable for Node.js plugin scenarios. Use `createRequire` to resolve the HTML file path from `node_modules`, read it with `fs.readFileSync`, replace the placeholder, then write to the target location.

```typescript
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const PLACEHOLDER = '__BUNDLE_DATA_PLACEHOLDER__'

const templatePath = require.resolve('vite-plugin-bundle-visual-viewer/template')
const template = readFileSync(templatePath, 'utf8')

const html = template.replace(PLACEHOLDER, () => JSON.stringify(bundleData))
writeFileSync('dist/bundle-visual.html', html, 'utf8')
```

`require.resolve` locates the file from `node_modules` at runtime — no hardcoded paths, no build order dependency.

### Option 2: Static import (Vite build pipeline)

In a Vite project you can import the HTML as a raw string and inject data via string replacement.

```typescript
import template from 'vite-plugin-bundle-visual-viewer/template?raw'

const PLACEHOLDER = '__BUNDLE_DATA_PLACEHOLDER__'
const html = template.replace(PLACEHOLDER, () => JSON.stringify(bundleData))
```

> `?raw` is a Vite-specific import modifier and only works inside the Vite build pipeline.

## Local Development

```bash
pnpm dev      # start dev server with built-in mock data
pnpm build    # build self-contained HTML to dist/index.html
```

In dev mode, `__BUNDLE_DATA__` is injected with mock data via `define` in `vite.config.ts`. In build mode it is replaced with the placeholder string, ready for the consumer to fill in real data at runtime.

## License

[MIT](../../LICENSE)
