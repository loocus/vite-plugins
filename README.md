# vite-plugin-bundle-visual

A Vite plugin that generates an interactive treemap report of your bundle composition.

![License](https://img.shields.io/npm/l/vite-plugin-bundle-visual)
![npm](https://img.shields.io/npm/v/vite-plugin-bundle-visual)

## Features

- Interactive treemap with zoom/pan
- Multiple tile algorithms (squarify, binary, slice, dice)
- Gzip size analysis
- Directory-based and heatmap color modes
- Duplicate module detection across chunks
- Search/filter modules
- Zero runtime dependencies

## Installation

```bash
# npm
npm install -D vite-plugin-bundle-visual

# pnpm
pnpm add -D vite-plugin-bundle-visual

# yarn
yarn add -D vite-plugin-bundle-visual
```

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { bundleVisual } from 'vite-plugin-bundle-visual'

export default defineConfig({
  plugins: [
    bundleVisual()
  ]
})
```

Run `vite build` and the report will be written to your output directory as `bundle-visual.html`.

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `filename` | `string` | `'bundle-visual.html'` | Output filename |
| `open` | `boolean` | `false` | Auto-open report in browser after build |
| `gzip` | `boolean` | `false` | Include gzip size analysis |
| `outDir` | `string` | Vite's `build.outDir` | Output directory for the report |
| `chunkSizeWarningLimit` | `number` | Vite's `build.chunkSizeWarningLimit * 1024` | Chunk size threshold in bytes for highlighting oversized chunks |

```ts
bundleVisual({
  filename: 'stats.html',
  open: true,
  gzip: true,
})
```

## Requirements

- Vite >= 5.0.0
- Node.js >= 24

## License

[MIT](./LICENSE)
