# vite-plugin-bundle-visual-viewer

[English](./README.md)

`vite-plugin-bundle-visual` 的可视化界面，基于 D3 渲染交互式 treemap，用于分析 Vite 构建产物的模块组成与体积分布。

构建产物是一个**自包含的单文件 HTML**（所有 JS/CSS 均内联），通过替换其中的占位符 `__BUNDLE_DATA_PLACEHOLDER__` 注入构建数据后即可独立运行，无需任何外部依赖。

## 数据格式

注入的数据需符合以下结构：

```typescript
interface BundleData {
  root: ModuleNode // 模块树根节点
  chunks: ChunkInfo[] // chunk 列表
  meta: {
    totalSize: number // 总体积（字节）
    totalGzipSize?: number // gzip 后总体积（字节，可选）
    buildTime: number // 构建时间戳（ms）
    chunkSizeWarningLimit: number // chunk 体积警告阈值（字节）
  }
}

interface ModuleNode {
  id: string
  label: string
  size: number // 原始体积（字节）
  gzipSize?: number
  children?: ModuleNode[]
  duplicatedInChunks?: string[] // 出现在多个 chunk 中时填充
}

interface ChunkInfo {
  id: string
  fileName: string
  size: number
  gzipSize?: number
  moduleIds: string[]
}
```

## 使用方式

### 方式一：运行时读取文件（推荐）

适用于 Node.js 插件场景。通过 `createRequire` 定位包内的 HTML 文件路径，再用 `fs.readFileSync` 读取内容，最后替换占位符写入目标位置。

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

`require.resolve` 会在运行时从 `node_modules` 中定位文件，无需关心包的安装路径，也不依赖构建顺序。

### 方式二：静态 import（Vite 构建场景）

在 Vite 项目中可以直接 import HTML 文件内容，再通过字符串替换注入数据。

```typescript
import template from 'vite-plugin-bundle-visual-viewer/template?raw'

const PLACEHOLDER = '__BUNDLE_DATA_PLACEHOLDER__'
const html = template.replace(PLACEHOLDER, () => JSON.stringify(bundleData))
```

> `?raw` 是 Vite 特有的导入修饰符，仅在 Vite 构建管道中有效。

## 本地开发

```bash
pnpm dev      # 启动开发服务器，使用内置 mock 数据预览
pnpm build    # 构建单文件 HTML 到 dist/index.html
```

开发模式下，`__BUNDLE_DATA__` 由 `vite.config.ts` 中的 `define` 注入 mock 数据；构建时替换为占位符字符串，由消费方在运行时填充真实数据。

## 许可证

[MIT](../../LICENSE)
