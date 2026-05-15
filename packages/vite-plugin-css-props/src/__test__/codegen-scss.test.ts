import { describe, expect, it } from 'vitest'
import { generateScss } from '../plugin/codegen-scss'
import { normalizeCssConfig } from '../plugin/normalize'

describe('generateScss', () => {
  it('should declare $__color-vars map pointing to var() expressions', () => {
    // #given
    const config = normalizeCssConfig({ colors: { primary: '#1677ff' } })

    // #when
    const scss = generateScss(config, true)

    // #then
    expect(scss).toContain('$__color-vars: (')
    expect(scss).toContain('\'primary\': var(--primary)')
  })

  it('should declare $__color-light and $__color-dark maps with raw values', () => {
    // #given
    const config = normalizeCssConfig({
      colors: { primary: '#1677ff', dark: { primary: '#4096ff' } },
    })

    // #when
    const scss = generateScss(config, true)

    // #then
    expect(scss).toContain('$__color-light: (')
    expect(scss).toContain('\'primary\': #1677ff')
    expect(scss).toContain('$__color-dark: (')
    expect(scss).toContain('\'primary\': #4096ff')
  })

  it('should declare $__prop-vars and $__prop-values maps', () => {
    // #given
    const config = normalizeCssConfig({ props: { spacingMd: '16px' } })

    // #when
    const scss = generateScss(config, true)

    // #then
    expect(scss).toContain('$__prop-vars: (')
    expect(scss).toContain('\'spacingMd\': var(--spacingMd)')
    expect(scss).toContain('$__prop-values: (')
    expect(scss).toContain('\'spacingMd\': 16px')
  })

  it('should declare colorVar, colorVal, propVar, propVal functions in camelCase', () => {
    // #given
    const config = normalizeCssConfig({
      colors: { primary: '#1677ff' },
      props: { spacingMd: '16px' },
    })

    // #when
    const scss = generateScss(config, true)

    // #then
    expect(scss).toMatch(/@function colorVar\(\$token\)/)
    expect(scss).toMatch(/@function colorVal\(\$token, \$theme: 'light'\)/)
    expect(scss).toMatch(/@function propVar\(\$token\)/)
    expect(scss).toMatch(/@function propVal\(\$token\)/)
  })

  it('should switch colorVal branches based on theme parameter', () => {
    // #given
    const config = normalizeCssConfig({ colors: { primary: '#1677ff' } })

    // #when
    const scss = generateScss(config, true)

    // #then
    expect(scss).toContain('@if $theme == \'dark\'')
    expect(scss).toContain('map.get($__color-light, $token)')
    expect(scss).toContain('map.get($__color-dark, $token)')
  })

  it('should emit @error guards for unknown tokens in every getter when strict is true', () => {
    // #given
    const config = normalizeCssConfig({
      colors: { primary: '#1677ff' },
      props: { spacingMd: '16px' },
    })

    // #when
    const scss = generateScss(config, true)

    // #then
    expect(scss).toContain('not map.has-key($__color-vars, $token)')
    expect(scss).toContain('not map.has-key($__color-light, $token)')
    expect(scss).toContain('not map.has-key($__prop-vars, $token)')
    expect(scss).toContain('not map.has-key($__prop-values, $token)')
    expect(scss).toMatch(/@error "\[vite-plugin-css-props\] Unknown color token/)
    expect(scss).toMatch(/@error "\[vite-plugin-css-props\] Unknown prop token/)
  })

  it('should emit @error guard for invalid theme name in colorVal when strict is true', () => {
    // #given
    const config = normalizeCssConfig({ colors: { primary: '#1677ff' } })

    // #when
    const scss = generateScss(config, true)

    // #then
    expect(scss).toContain('$theme != \'light\' and $theme != \'dark\'')
    expect(scss).toMatch(/@error "\[vite-plugin-css-props\] Invalid theme/)
  })

  it('should omit all @error guards when strict is false', () => {
    // #given
    const config = normalizeCssConfig({
      colors: { primary: '#1677ff' },
      props: { spacingMd: '16px' },
    })

    // #when
    const scss = generateScss(config, false)

    // #then
    expect(scss).not.toContain('@error')
    expect(scss).not.toContain('map.has-key')
    expect(scss).toContain('@function colorVar')
    expect(scss).toContain('@function propVal')
  })

  it('should declare alpha/lighten/darken/mix color operation functions', () => {
    // #given
    const config = normalizeCssConfig({ colors: { primary: '#1677ff' } })

    // #when
    const scss = generateScss(config, true)

    // #then
    expect(scss).toMatch(/@function alpha\(\$color, \$ratio\)/)
    expect(scss).toMatch(/@function lighten\(\$color, \$ratio\)/)
    expect(scss).toMatch(/@function darken\(\$color, \$ratio\)/)
    expect(scss).toMatch(/@function mix\(\$colorA, \$colorB, \$weight: 0\.5\)/)
  })

  it('should emit _is-css-expr helper that detects var() and color-mix() strings', () => {
    // #given
    const config = normalizeCssConfig({ colors: { primary: '#1677ff' } })

    // #when
    const scss = generateScss(config, true)

    // #then
    expect(scss).toContain('@function _is-css-expr')
    expect(scss).toContain('string.index(#{$value}, \'var(\')')
    expect(scss).toContain('string.index(#{$value}, \'color-mix(\')')
  })

  it('should branch alpha to color.change for color literal and color-mix for css expression', () => {
    // #given
    const config = normalizeCssConfig({ colors: { primary: '#1677ff' } })

    // #when
    const scss = generateScss(config, true)

    // #then
    expect(scss).toContain('color.change($color, $alpha: $ratio)')
    expect(scss).toContain('color-mix(in oklch, #{$color} #{$ratio * 100%}, transparent)')
  })

  it('should @use sass:color, sass:string, sass:meta for color operations', () => {
    // #given
    const config = normalizeCssConfig({ colors: { primary: '#1677ff' } })

    // #when
    const scss = generateScss(config, true)

    // #then
    expect(scss).toContain('@use \'sass:color\'')
    expect(scss).toContain('@use \'sass:string\'')
    expect(scss).toContain('@use \'sass:meta\'')
  })
})
