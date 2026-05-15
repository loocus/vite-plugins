# vite-plugin-css-props

[中文文档](./README.zh-CN.md)

Generate JS / CSS / SCSS bindings and a literal-typed `.d.ts` from a single configuration file. Colors and generic CSS properties have separate APIs, and colors support dark mode switching.

## Design Philosophy

Two distinct kinds of CSS Custom Properties are kept separate:

- **`colors`** — theme tokens that switch with dark mode
- **`props`** — generic CSS values (spacing, radius, font size, ...) that are theme-agnostic

Two independent APIs: `colorVar/colorVal` for colors (with a `dark` parameter), and `propVar/propVal` for generic properties (no `dark` concept).

## Features

- **One config, multiple outputs**: JS virtual module, CSS custom properties (auto-injected), SCSS virtual module (`@use`), auto-generated `.d.ts`
- **Literal types**: hovering on `colorVal('primary', 'dark')` shows `'#4096ff'`
- **O(1) type lookup**: the generated `.d.ts` uses indexed access types, friendly to the TS checker even with hundreds of tokens
- **Two value outlets**: `colorVar` returns a CSS variable reference (follows runtime dark mode), `colorVal` returns the raw value (ECharts / Canvas / Sass color functions)
- **Unified color operations**: `alpha` / `lighten` / `darken` / `mix` with identical API across TS and SCSS, auto-dispatch between `color-mix()` (var path) and computed literals (value path)
- **Dark mode**: based on a `:root.dark` selector by default (configurable)
- **HMR**: editing `css.config.ts` regenerates outputs and triggers a hot reload

## Install

```bash
pnpm add -D vite-plugin-css-props sass
```

`sass` is an optional peer dependency, only required when consuming SCSS. Minimum Sass version is **1.79** (for the modern `color.mix($method)` API used by the unified color operations).

## Quick Start

### 1. Configure the plugin

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

### 2. Write the config

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

Inside `colors.dark` you only list the **tokens that differ** from light; the rest inherit the light value. `props` has no `dark` sub-key — these are theme-agnostic design tokens.

### 3. Consume from TS / JS

```ts
import {
  colorKeys,
  colorVal,
  colorVar,
  propKeys,
  propVal,
  propVar,
} from 'virtual:css-props'

// Color — CSS variable reference, follows :root.dark automatically
colorVar('primary') // 'var(--primary)'

// Color — raw value (ECharts / Canvas / SVG)
colorVal('primary') // '#1677ff'
colorVal('primary', 'dark') // '#4096ff'

// Generic prop — no dark concept
propVar('spacingMd') // 'var(--spacingMd)'
propVal('spacingMd') // '16px'

// Iterate / destructure (for building selects, audit tables, ...)
colorKeys() // readonly ['primary', 'success', 'bg', 'text']
propKeys() // readonly ['spacingMd', 'radiusLg', 'fontSizeBase']
```

The CSS custom property declarations are **auto-injected** as a `<style>` tag in your entry HTML — you don't need to import any CSS file.

### 4. Consume from SCSS

```scss
@use 'virtual:css-props' as c;

.button {
  color: c.colorVar('primary');                     // var(--primary)
  padding: c.propVar('spacingMd');                  // var(--spacingMd)
  border: 1px solid c.lighten(c.colorVal('primary'), 0.1); // computed at compile time
}
```

SCSS function names mirror the TS API in camelCase: `colorVar` / `colorVal` / `propVar` / `propVal`, plus the unified color operations `alpha` / `lighten` / `darken` / `mix` (see step 6).

### 5. Toggle dark mode

```ts
document.documentElement.classList.toggle('dark')
```

CSS variables returned by `colorVar` are bound to the `:root` / `:root.dark` blocks, so element colors update automatically.

### 6. Color operations (unified across TS and SCSS)

Four pure functions are exposed from the same virtual module on both sides: `alpha`, `lighten`, `darken`, `mix`. Same names, same parameter order, same semantics — copy code freely between `.ts` and `.scss`.

```ts
import { alpha, colorVal, colorVar, darken, lighten, mix } from 'virtual:css-props'

// CSS-variable path → returns a `color-mix(in oklch, ...)` expression that
// follows :root.dark switching at runtime.
alpha(colorVar('primary'), 0.6)
// → 'color-mix(in oklch, var(--primary) 60%, transparent)'

// Literal path → computed at call time via colord, returns a static value
// suitable for ECharts / Canvas / inline style with no CSS variable needed.
alpha(colorVal('primary'), 0.6)
// → 'rgba(22, 119, 255, 0.6)'

// Compose freely — nested CSS expressions are valid Color Module Level 5.
lighten(alpha(colorVar('primary'), 0.5), 0.1)

// mix defaults weight to 0.5
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

Dispatch rule: the input is checked for `var(` or `color-mix(` substrings. If present, the result is a `color-mix()` CSS expression. Otherwise the value is parsed and computed by colord at call time.

**Caveats**

- Nested OKLCH `color-mix` blends alpha into the mix channel, so `lighten(alpha(x, 0.5), 0.1)` does not preserve the original 0.5 alpha — this is per CSS Color Module Level 5 spec.
- Browser support for `color-mix()` and nesting: Chrome 111+ / Safari 16.2+ / Firefox 113+.
- SCSS color operations use the modern `color.mix($method: oklch)` API, which requires Dart Sass `>=1.79`.

---

## Options

```ts
cssPropsPlugin({
  // Config payload: object OR file path (mutually exclusive)
  config: { colors: { primary: '#1677ff' } },
  // or
  configFile: 'css.config.ts',

  // Global prefix for CSS variable names (default: none)
  prefix: 'app-', // produces --app-primary

  // Dark mode selector (default ':root.dark')
  darkSelector: ':root.dark',

  // Type declarations
  dts: {
    enabled: true, // default true
    outFile: 'src/types/css-props.d.ts', // default
  },

  // SCSS code generation
  scss: {
    strict: true, // default true: emit @error guards on unknown tokens / invalid theme
    // false: silent map.get fallback (returns null on miss)
  },
})
```

The CSS variable declarations are always auto-injected into the entry HTML — there's no opt-out flag, and no `virtual:css-props.css` import to remember.

---

## How it works

| Output | Form | Physical file |
|--------|------|---------------|
| `virtual:css-props` (JS) | Vite virtual module, in-memory | No |
| CSS custom property declarations | injected as inline `<style>` into entry HTML | No |
| `@use 'virtual:css-props'` (SCSS) | Sass modern importer, in-memory | No |
| `vite-plugin-css-props/runtime` | Real subpath export (color operations) | Yes (`dist/runtime.{mjs,cjs}`) |
| `src/types/css-props.d.ts` | Real file | Yes (TS must read from disk) |

The config file is compiled with esbuild into a temp file and `import()`-ed — the same approach Vite uses for `vite.config.ts`. HMR: a config change invalidates the JS virtual module, rewrites the d.ts, and triggers a browser full reload.

The generated types use indexed access (`ColorVars[T]`) instead of long conditional chains, keeping d.ts size linear in token count and lookups O(1) for the TS checker.

Color operations (`alpha` / `lighten` / `darken` / `mix`) are sourced from the runtime subpath module — the JS virtual module re-exports them so users only need to import from `'virtual:css-props'`.

---

## Known limitation: Sass IDE hints

`@use 'virtual:css-props'` is **not recognized by editor static analysis**:

- the path is underlined as missing
- `c.colorVar('primary')` gets no completion
- go-to-definition fails

But **runtime behavior is fully correct** — the Sass importer resolves it at compile time.

This is a limitation of SCSS language servers (they index physical files and don't understand the `virtual:` protocol).

The TS side is unaffected: `virtual:css-props` provides full literal-type completion through the auto-generated `.d.ts`.

To compensate for the missing IDE validation on the SCSS side, the four getters (`colorVar` / `colorVal` / `propVar` / `propVal`) include **compile-time key guards** by default: passing an unknown token raises a Sass `@error` listing every available key, pointing at the exact source line. `colorVal` additionally validates that `$theme` is `'light'` or `'dark'`. Disable via `scss: { strict: false }` if you prefer silent `null` fallback.

The color operation functions (`alpha` / `lighten` / `darken` / `mix`) accept any color value — Sass color literals, CSS variable references via `colorVar`, or composed `color-mix()` expressions — so they don't need key guards.

---

## CSS variable naming

CSS variable names are **identical to the config keys** (no case conversion):

```ts
defineCssConfig({
  colors: {
    primary: '#1677ff', // → --primary
  },
  props: {
    'spacingMd': '16px', // → --spacingMd
    'spacing-lg': '24px', // → --spacing-lg (use a kebab key if you want kebab CSS)
  },
})
```

With `prefix: 'app-'` the names become `--app-primary`, etc.

---

## tsconfig.json

Make sure the generated d.ts is picked up by your TS project:

```json
{
  "include": ["src", "src/types/css-props.d.ts"]
}
```

Or add `src/types/css-props.d.ts` to the project's existing `include`.

---

## License

MIT
