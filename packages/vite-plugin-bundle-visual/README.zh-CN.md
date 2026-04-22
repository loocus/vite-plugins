# vite-plugin-bundle-visual

[English](./README.md)

一个 Vite 插件，用于生成交互式 treemap 报告，直观展示构建产物的组成结构。

![License](https://img.shields.io/npm/l/vite-plugin-bundle-visual)
![npm](https://img.shields.io/npm/v/vite-plugin-bundle-visual)

## 特性

- 交互式 treemap，支持缩放/平移
- 多种平铺算法（squarify、binary、slice、dice）
- Gzip 体积分析
- 目录着色与热力图两种颜色模式
- 跨 chunk 重复模块检测
- 模块搜索/过滤
- 零运行时依赖

## 安装

```bash
# npm
npm install -D vite-plugin-bundle-visual

# pnpm
pnpm add -D vite-plugin-bundle-visual

# yarn
yarn add -D vite-plugin-bundle-visual
```

## 使用

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

执行 `vite build` 后，报告文件 `bundle-visual.html` 会输出到构建目录中。

## 配置项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `filename` | `string` | `'bundle-visual.html'` | 输出文件名 |
| `open` | `boolean` | `false` | 构建完成后自动在浏览器中打开报告 |
| `gzip` | `boolean` | `false` | 是否分析 gzip 压缩后的体积 |
| `outDir` | `string` | Vite 的 `build.outDir` | 报告文件的输出目录 |
| `chunkSizeWarningLimit` | `number` | Vite 的 `build.chunkSizeWarningLimit * 1024` | chunk 体积警告阈值（字节），超出时高亮显示 |

```ts
bundleVisual({
  filename: 'stats.html',
  open: true,
  gzip: true,
})
```

## 环境要求

- Vite >= 5.0.0
- Node.js >= 24

## 仓库

[github.com/loocus/vite-plugins](https://github.com/loocus/vite-plugins)

## 许可证

[MIT](../../LICENSE)
