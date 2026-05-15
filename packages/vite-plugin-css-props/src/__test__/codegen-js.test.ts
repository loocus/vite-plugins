import { describe, expect, it } from 'vitest'
import { generateJs } from '../plugin/codegen-js'
import { normalizeCssConfig } from '../plugin/normalize'
import { createColorOps } from '../runtime/color-ops'

interface CssPropsModule {
  colorVar: (token: string) => string
  colorVal: (token: string, theme?: string) => string
  colorKeys: () => readonly string[]
  propVar: (token: string) => string
  propVal: (token: string) => string
  propKeys: () => readonly string[]
  alpha: (input: string, ratio: number) => string
  lighten: (input: string, ratio: number) => string
  darken: (input: string, ratio: number) => string
  mix: (a: string, b: string, weight?: number) => string
}

function evalModule(source: string): CssPropsModule {
  const transformed = `${source
    .replace(/^import\s+\{[^}]*\}\s+from\s+['"][^'"]+['"]\s*(?:;\s*)?$/gm, '')
    .replace(/export const /g, 'const ')
    .replace(/export function/g, 'function')
  }\nreturn { colorVar, colorVal, colorKeys, propVar, propVal, propKeys, alpha, lighten, darken, mix };`
  // eslint-disable-next-line no-new-func
  return new Function('createColorOps', transformed)(createColorOps) as CssPropsModule
}

describe('generateJs', () => {
  it('should emit colorVar returning the css var expression for color tokens', () => {
    // #given
    const config = normalizeCssConfig({ colors: { primary: '#1677ff' } })

    // #when
    const mod = evalModule(generateJs(config))

    // #then
    expect(mod.colorVar('primary')).toBe('var(--primary)')
  })

  it('should emit colorVal returning light value by default and dark when requested', () => {
    // #given
    const config = normalizeCssConfig({
      colors: { primary: '#1677ff', dark: { primary: '#4096ff' } },
    })

    // #when
    const mod = evalModule(generateJs(config))

    // #then
    expect(mod.colorVal('primary')).toBe('#1677ff')
    expect(mod.colorVal('primary', 'dark')).toBe('#4096ff')
  })

  it('should emit colorKeys returning the color token list', () => {
    // #given
    const config = normalizeCssConfig({
      colors: { primary: '#1677ff', success: '#52c41a' },
    })

    // #when
    const mod = evalModule(generateJs(config))

    // #then
    expect(mod.colorKeys()).toEqual(['primary', 'success'])
  })

  it('should emit propVar returning the css var expression for prop tokens', () => {
    // #given
    const config = normalizeCssConfig({ props: { spacingMd: '16px' } })

    // #when
    const mod = evalModule(generateJs(config))

    // #then
    expect(mod.propVar('spacingMd')).toBe('var(--spacingMd)')
  })

  it('should emit propVal returning the raw value for prop tokens (no theme)', () => {
    // #given
    const config = normalizeCssConfig({ props: { spacingMd: '16px' } })

    // #when
    const mod = evalModule(generateJs(config))

    // #then
    expect(mod.propVal('spacingMd')).toBe('16px')
  })

  it('should emit propKeys returning the prop token list', () => {
    // #given
    const config = normalizeCssConfig({
      props: { spacingMd: '16px', radiusLg: '12px' },
    })

    // #when
    const mod = evalModule(generateJs(config))

    // #then
    expect(mod.propKeys()).toEqual(['spacingMd', 'radiusLg'])
  })

  it('should keep colors and props in separate lookup tables', () => {
    // #given
    const config = normalizeCssConfig({
      colors: { primary: '#1677ff' },
      props: { spacingMd: '16px' },
    })

    // #when
    const mod = evalModule(generateJs(config))

    // #then
    expect(mod.colorKeys()).toEqual(['primary'])
    expect(mod.propKeys()).toEqual(['spacingMd'])
  })

  it('should expose color operation helpers wired to createColorOps', () => {
    // #given
    const config = normalizeCssConfig({ colors: { primary: '#1677ff' } })

    // #when
    const mod = evalModule(generateJs(config))

    // #then
    expect(mod.alpha(mod.colorVar('primary'), 0.5))
      .toBe('color-mix(in oklch, var(--primary) 50%, transparent)')
    expect(mod.alpha(mod.colorVal('primary'), 0.5))
      .toBe('rgba(22, 119, 255, 0.5)')
  })

  it('should declare runtime import for color operations', () => {
    // #given
    const config = normalizeCssConfig({ colors: { primary: '#1677ff' } })

    // #when
    const source = generateJs(config)

    // #then
    expect(source).toContain('import { createColorOps } from \'vite-plugin-css-props/runtime\'')
  })
})
