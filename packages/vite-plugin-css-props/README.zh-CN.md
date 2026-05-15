# vite-plugin-css-props

[English](./README.md)

从单一配置文件生成 CSS Custom Properties 的 JS / CSS / SCSS 绑定与字面量类型 `.d.ts`，颜色和普通 CSS 属性各自独立的 API，颜色支持暗黑模式切换。

## 设计理念

明确区分两类 CSS Custom Properties：

- **`colors`** — 主题色，跟随暗黑模式动态切换
- **`props`** — 间距 / 圆角 / 字号等通用 CSS 属性，与主题无关

两套独立的 API：`colorVar/colorVal` 处理颜色（含 `dark` 参数），`propVar/propVal` 处理通用属性（无 `dark` 概念）。

## 特性

- **一份配置，多种产物**：JS 虚拟模块、CSS 自定义属性（自动注入）、SCSS 虚拟模块（`@use`），自动生成 `.d.ts`
- **字面量类型**：`colorVal('primary', 'dark')` 的 hover 类型显示为 `'#4096ff'`
- **类型查询 O(1)**：`.d.ts` 用 indexed access type，对 TS 检查器友好，token 数百个也无压力
- **两套值出口**：`colorVar` 返回 CSS 变量引用（运行时跟随暗黑切换），`colorVal` 返回真实值（ECharts / Canvas / Sass 颜色函数）
- **统一颜色操作**：`alpha` / `lighten` / `darken` / `mix` 在 TS 与 SCSS 两端 API 完全一致，自动在 `color-mix()`（var 路径）和编译期字面量（值路径）之间分发
- **暗黑模式**：默认 `:root.dark` 选择器（可配置）
- **HMR**：修改 `css.config.ts` 自动重新生成产物并热更新

## 安装

```bash
pnpm add -D vite-plugin-css-props sass
```

`sass` 是可选 peer 依赖，仅在使用 SCSS 时需要。**最低版本 1.79**（统一颜色操作用到 `color.mix($method)` 现代 API）。

## 快速开始

### 1. 配置插件

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { cssPropsPlugin } from 'vite-plugin-css-props'

export default defineConfig({
  plugins: [
    cssPropsPlugin({
      configFile: 'css.config.ts',
    }),
  ],
})
```

### 2. 写配置文件

```ts
// css.config.ts
import { defineCssConfig } from 'vite-plugin-css-props'

export default defineCssConfig({
  colors: {
    primary: '#1677ff',
    success: '#52c41a',
    bg: '#ffffff',
    text: '#1f1f1f',

    dark: {
      primary: '#4096ff',
      bg: '#141414',
      text: 'rgba(255,255,255,0.85)',
    },
  },
  props: {
    spacingMd: '16px',
    radiusLg: '12px',
    fontSizeBase: '14px',
  },
})
```

`colors.dark` 中只写**有差异**的 token，其余继承 light 默认值。`props` 没有 dark 子键——它是与主题无关的设计变量。

### 3. 在 TS/JS 中消费

```ts
import {
  colorKeys,
  colorVal,
  colorVar,
  propKeys,
  propVal,
  propVar,
} from 'virtual:css-props'

// 颜色 — CSS 变量引用，自动跟随 :root.dark 切换
colorVar('primary') // 'var(--primary)'

// 颜色 — 真实值（ECharts / Canvas / SVG）
colorVal('primary') // '#1677ff'
colorVal('primary', 'dark') // '#4096ff'

// 普通 props — 没有 dark 概念
propVar('spacingMd') // 'var(--spacingMd)'
propVal('spacingMd') // '16px'

// 迭代 / 解构（构建 select、检查表用）
colorKeys() // readonly ['primary', 'success', 'bg', 'text']
propKeys() // readonly ['spacingMd', 'radiusLg', 'fontSizeBase']
```

CSS 自定义属性声明会**自动注入**到入口 HTML 的 `<style>` 标签中——无需手动 import 任何 CSS 文件。

### 4. 在 SCSS 中消费

```scss
@use 'virtual:css-props' as c;

.button {
  color: c.colorVar('primary');                            // var(--primary)
  padding: c.propVar('spacingMd');                         // var(--spacingMd)
  border: 1px solid c.lighten(c.colorVal('primary'), 0.1); // 编译期算
}
```

SCSS 函数名与 TS API 对齐采用小驼峰：`colorVar` / `colorVal` / `propVar` / `propVal`，以及统一颜色操作 `alpha` / `lighten` / `darken` / `mix`（见 6）。

### 5. 切换暗黑模式

```ts
document.documentElement.classList.toggle('dark')
```

`colorVar` 返回的 CSS 变量与 `:root` / `:root.dark` 块联动，元素颜色自动更新。

### 6. 颜色操作（TS 与 SCSS 统一 API）

从同一个虚拟模块在 TS / SCSS 两端导出四个纯函数：`alpha`、`lighten`、`darken`、`mix`。**函数名、参数顺序、参数语义完全一致**，跨语言复制代码无需翻译。

```ts
import { alpha, colorVal, colorVar, darken, lighten, mix } from 'virtual:css-props'

// CSS 变量路径：返回 color-mix() 表达式，运行时跟随 :root.dark 切换
alpha(colorVar('primary'), 0.6)
// → 'color-mix(in oklch, var(--primary) 60%, transparent)'

// 字面量路径：调用时由 colord 计算出固定值，给 ECharts / Canvas / inline style 用
alpha(colorVal('primary'), 0.6)
// → 'rgba(22, 119, 255, 0.6)'

// 嵌套调用合法（CSS Color Module Level 5）
lighten(alpha(colorVar('primary'), 0.5), 0.1)

// mix 的 weight 默认 0.5
mix(colorVar('primary'), colorVar('bg'), 0.3)
```

```scss
@use 'virtual:css-props' as c;

.tooltip {
  background: c.alpha(c.colorVar('primary'), 0.6);
}

.button-disabled {
  background: c.alpha(c.colorVal('primary'), 0.3);
}

.surface-elevated {
  background: c.lighten(c.colorVar('bg'), 0.05);
}
```

**分发规则**：检测输入是否包含 `var(` 或 `color-mix(` 子串。命中则返回 `color-mix()` CSS 表达式；否则交给 colord 在调用时算出字面量。

**注意事项**

- 嵌套 OKLCH `color-mix` 会把 alpha 也参与混合，`lighten(alpha(x, 0.5), 0.1)` 不会保留 0.5 透明度——这是 CSS Color Module Level 5 的规范行为。
- 浏览器支持：Chrome 111+ / Safari 16.2+ / Firefox 113+。
- SCSS 端用到现代 `color.mix($method: oklch)` API，**需要 Dart Sass `>=1.79`**。

---

## 配置项

```ts
cssPropsPlugin({
  // 配置数据：对象 或 文件路径（二选一）
  config: { colors: { primary: '#1677ff' } },
  // 或
  configFile: 'css.config.ts',

  // CSS 变量统一前缀（默认无前缀）
  prefix: 'app-', // 生成 --app-primary

  // 暗黑模式选择器（默认 ':root.dark'）
  darkSelector: ':root.dark',

  // 类型声明
  dts: {
    enabled: true, // 默认 true
    outFile: 'src/types/css-props.d.ts', // 默认值
  },

  // SCSS 代码生成
  scss: {
    strict: true, // 默认 true：在未知 token / 非法 theme 时抛 @error
    // false：静默 map.get 兜底（命中失败返回 null）
  },
})
```

CSS 变量声明始终自动注入到入口 HTML，无配置项控制，也不需要再 import `virtual:css-props.css`。

---

## 工作原理

| 产物 | 形态 | 是否物理文件 |
|------|------|------------|
| `virtual:css-props`（JS） | Vite 虚拟模块，内存生成 | ❌ |
| CSS 自定义属性声明 | 自动注入到入口 HTML 的 `<style>` 标签 | ❌ |
| `@use 'virtual:css-props'`（SCSS） | Sass modern importer，内存生成 | ❌ |
| `vite-plugin-css-props/runtime` | 真实子路径导出（颜色操作运行时） | ✅（`dist/runtime.{mjs,cjs}`） |
| `src/types/css-props.d.ts` | 真实文件 | ✅（TS 必须从文件系统读） |

配置文件用 esbuild 临时编译后 `import()`，与 Vite 加载 `vite.config.ts` 同思路。HMR：配置变化触发 JS 虚拟模块失效 + d.ts 重新写入 + 浏览器 full reload。

类型设计上使用 indexed access (`ColorVars[T]`)，避免长条件类型链对 TS 检查器的压力，token 数量增长是线性 d.ts 体积、O(1) 查询性能。

颜色操作（`alpha` / `lighten` / `darken` / `mix`）来自 runtime 子路径模块；JS 虚拟模块对它们做 re-export，所以使用方只需 `import` from `'virtual:css-props'`。

---

## 已知限制：Sass IDE 提示

`@use 'virtual:css-props'` 这种写法**编辑器静态分析不识别**：

- 路径会显示红线
- `c.colorVar('primary')` 没有补全
- F12 跳转失败

但**运行时完全正常**——Sass importer 在编译时接管解析。

这是 SCSS 语言服务器的限制（它通过物理文件索引，不认 `virtual:` 协议）。

TS 端不受影响，`virtual:css-props` 在 TS 端通过自动生成的 `.d.ts` 提供完整字面量类型补全。

为弥补 SCSS 侧缺失的 IDE 校验，四个 getter (`colorVar` / `colorVal` / `propVar` / `propVal`) 默认开启**编译期 key 守卫**：传入未定义 token 时 Sass 直接抛 `@error` 并列出所有可用 key，定位到具体源文件行号。`colorVal` 还会校验 `$theme` 必须为 `'light'` 或 `'dark'`。如果倾向于静默兜底（命中失败返回 `null`），可设 `scss: { strict: false }` 关闭。

颜色操作函数（`alpha` / `lighten` / `darken` / `mix`）接受任意颜色值——Sass 颜色字面量、`colorVar` 返回的 CSS 变量引用、或嵌套的 `color-mix()` 表达式——因此不需要 key 守卫。

---

## CSS 变量命名规则

CSS 变量名与配置 key **完全一致**（不做大小写转换）：

```ts
defineCssConfig({
  colors: {
    primary: '#1677ff', // → --primary
  },
  props: {
    'spacingMd': '16px', // → --spacingMd
    'spacing-lg': '24px', // → --spacing-lg（用 kebab key 让 CSS 也是 kebab）
  },
})
```

加 `prefix: 'app-'` 后变成 `--app-primary` 等。

---

## tsconfig.json

确保生成的 d.ts 被 TS 项目识别：

```json
{
  "include": ["src", "src/types/css-props.d.ts"]
}
```

或者把 `src/types/css-props.d.ts` 加进项目的 `include`。

---

## License

MIT
