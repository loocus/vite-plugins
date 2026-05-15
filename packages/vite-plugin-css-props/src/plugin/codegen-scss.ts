import type { NormalizedCssConfig } from '../types'

function escapeScssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')
}

function buildMapEntries(
  map: Readonly<Record<string, string>>,
  tokens: readonly string[],
): string {
  return tokens
    .map(token => `  '${escapeScssString(token)}': ${map[token]}`)
    .join(',\n')
}

function buildVarMap(tokens: readonly string[], varExpr: (token: string) => string): string {
  return tokens
    .map(token => `  '${escapeScssString(token)}': ${varExpr(token)}`)
    .join(',\n')
}

function unknownTokenGuard(mapVar: string, fnLabel: string, kind: 'color' | 'prop'): string {
  return `  @if not map.has-key(${mapVar}, $token) {
    @error "[vite-plugin-css-props] Unknown ${kind} token '#{$token}' passed to ${fnLabel}(). Available tokens: #{map.keys(${mapVar})}.";
  }
`
}

function invalidThemeGuard(): string {
  return `  @if $theme != 'light' and $theme != 'dark' {
    @error "[vite-plugin-css-props] Invalid theme '#{$theme}' passed to colorVal(). Expected 'light' or 'dark'.";
  }
`
}

export function generateScss(config: NormalizedCssConfig, strict: boolean): string {
  const colorVarGuard = strict ? unknownTokenGuard('$__color-vars', 'colorVar', 'color') : ''
  const colorValThemeGuard = strict ? invalidThemeGuard() : ''
  const colorValTokenGuard = strict ? unknownTokenGuard('$__color-light', 'colorVal', 'color') : ''
  const propVarGuard = strict ? unknownTokenGuard('$__prop-vars', 'propVar', 'prop') : ''
  const propValGuard = strict ? unknownTokenGuard('$__prop-values', 'propVal', 'prop') : ''

  return `@use 'sass:map';
@use 'sass:color';
@use 'sass:string';
@use 'sass:meta';

$__color-vars: (
${buildVarMap(config.colors.tokens, config.varExpr)}
);

$__color-light: (
${buildMapEntries(config.colors.light, config.colors.tokens)}
);

$__color-dark: (
${buildMapEntries(config.colors.dark, config.colors.tokens)}
);

$__prop-vars: (
${buildVarMap(config.props.tokens, config.varExpr)}
);

$__prop-values: (
${buildMapEntries(config.props.values, config.props.tokens)}
);

@function _is-css-expr($value) {
  @if meta.type-of($value) != 'string' {
    @return false;
  }
  @return string.index(#{$value}, 'var(') != null
       or string.index(#{$value}, 'color-mix(') != null;
}

@function colorVar($token) {
${colorVarGuard}  @return map.get($__color-vars, $token);
}

@function colorVal($token, $theme: 'light') {
${colorValThemeGuard}${colorValTokenGuard}  @if $theme == 'dark' {
    @return map.get($__color-dark, $token);
  }
  @return map.get($__color-light, $token);
}

@function propVar($token) {
${propVarGuard}  @return map.get($__prop-vars, $token);
}

@function propVal($token) {
${propValGuard}  @return map.get($__prop-values, $token);
}

@function alpha($color, $ratio) {
  @if _is-css-expr($color) {
    @return color-mix(in oklch, #{$color} #{$ratio * 100%}, transparent);
  }
  @return color.change($color, $alpha: $ratio);
}

@function lighten($color, $ratio) {
  @if _is-css-expr($color) {
    @return color-mix(in oklch, white #{$ratio * 100%}, #{$color});
  }
  @return color.mix(white, $color, $ratio * 100%, $method: oklch);
}

@function darken($color, $ratio) {
  @if _is-css-expr($color) {
    @return color-mix(in oklch, black #{$ratio * 100%}, #{$color});
  }
  @return color.mix(black, $color, $ratio * 100%, $method: oklch);
}

@function mix($colorA, $colorB, $weight: 0.5) {
  @if _is-css-expr($colorA) or _is-css-expr($colorB) {
    @return color-mix(in oklch, #{$colorA} #{$weight * 100%}, #{$colorB});
  }
  @return color.mix($colorA, $colorB, $weight * 100%, $method: oklch);
}
`
}
