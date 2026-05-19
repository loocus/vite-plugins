import { describe, expect, it } from 'vitest'
import { generateDts } from '../plugin/codegen-dts'
import { normalizeCssConfig } from '../plugin/normalize'

describe('generateDts', () => {
  it('should declare module \'virtual:css-props\' with all five interfaces', () => {
    // #given
    const config = normalizeCssConfig({
      colors: { primary: '#1677ff' },
      props: { spacingMd: '16px' },
    })

    // #when
    const dts = generateDts(config)

    // #then
    expect(dts).toContain('declare module \'virtual:css-props\'')
    expect(dts).toContain('interface ColorVars')
    expect(dts).toContain('interface ColorLightValues')
    expect(dts).toContain('interface ColorDarkValues')
    expect(dts).toContain('interface PropVars')
    expect(dts).toContain('interface PropValues')
  })

  it('should expose ColorToken and PropToken via keyof for O(1) lookup', () => {
    // #given
    const config = normalizeCssConfig({
      colors: { primary: '#1677ff' },
      props: { spacingMd: '16px' },
    })

    // #when
    const dts = generateDts(config)

    // #then
    expect(dts).toContain('export type ColorToken = keyof ColorVars')
    expect(dts).toContain('export type PropToken = keyof PropVars')
    expect(dts).not.toContain('T extends \'primary\'')
  })

  it('should map color tokens to var() literals on ColorVars', () => {
    // #given
    const config = normalizeCssConfig({ colors: { primary: '#1677ff' } })

    // #when
    const dts = generateDts(config)

    // #then
    expect(dts).toContain('readonly \'primary\': \'var(--primary)\'')
  })

  it('should map color tokens to literal light value on ColorLightValues', () => {
    // #given
    const config = normalizeCssConfig({
      colors: { primary: '#1677ff', dark: { primary: '#4096ff' } },
    })

    // #when
    const dts = generateDts(config)

    // #then
    expect(dts).toContain('readonly \'primary\': \'#1677ff\'')
  })

  it('should map color tokens to literal dark value on ColorDarkValues', () => {
    // #given
    const config = normalizeCssConfig({
      colors: { primary: '#1677ff', dark: { primary: '#4096ff' } },
    })

    // #when
    const dts = generateDts(config)

    // #then
    expect(dts).toContain('readonly \'primary\': \'#4096ff\'')
  })

  it('should map prop tokens to var() literals on PropVars and raw values on PropValues', () => {
    // #given
    const config = normalizeCssConfig({ props: { spacingMd: '16px' } })

    // #when
    const dts = generateDts(config)

    // #then
    expect(dts).toContain('readonly \'spacingMd\': \'var(--spacingMd)\'')
    expect(dts).toContain('readonly \'spacingMd\': \'16px\'')
  })

  it('should declare colorVar / colorVal / colorKeys', () => {
    // #given
    const config = normalizeCssConfig({ colors: { primary: '#1677ff' } })

    // #when
    const dts = generateDts(config)

    // #then
    expect(dts).toContain('colorVar<T extends ColorToken>(token: T): ColorVars[T]')
    expect(dts).toContain('colorVal<T extends ColorToken>(token: T): ColorLightValues[T]')
    expect(dts).toContain('): ColorValuesByName[N][T]')
    expect(dts).toContain('colorKeys(): readonly ColorToken[]')
  })

  it('should declare propVar / propVal / propKeys without theme overload', () => {
    // #given
    const config = normalizeCssConfig({ props: { spacingMd: '16px' } })

    // #when
    const dts = generateDts(config)

    // #then
    expect(dts).toContain('propVar<T extends PropToken>(token: T): PropVars[T]')
    expect(dts).toContain('propVal<T extends PropToken>(token: T): PropValues[T]')
    expect(dts).toContain('propKeys(): readonly PropToken[]')
  })

  it('should not declare module \'virtual:css-props.css\' since CSS is auto-injected', () => {
    // #given
    const config = normalizeCssConfig({ colors: { primary: '#1677ff' } })

    // #when
    const dts = generateDts(config)

    // #then
    expect(dts).not.toContain('declare module \'virtual:css-props.css\'')
  })

  it('should emit empty interfaces when no tokens are defined', () => {
    // #given
    const config = normalizeCssConfig({})

    // #when
    const dts = generateDts(config)

    // #then
    expect(dts).toContain('interface ColorVars {}')
    expect(dts).toContain('interface PropVars {}')
  })

  it('should reflect prefix in generated var literals', () => {
    // #given
    const config = normalizeCssConfig({
      colors: { primary: '#1677ff' },
      props: { spacingMd: '16px' },
    }, 'app-')

    // #when
    const dts = generateDts(config)

    // #then
    expect(dts).toContain('\'var(--app-primary)\'')
    expect(dts).toContain('\'var(--app-spacingMd)\'')
  })

  it('should prepend eslint-disable and ts-nocheck banners to bypass lint and type checking on generated file', () => {
    // #given
    const config = normalizeCssConfig({ colors: { primary: '#1677ff' } })

    // #when
    const dts = generateDts(config)

    // #then
    expect(dts.startsWith('/* eslint-disable */\n// @ts-nocheck\n')).toBe(true)
  })

  it('should declare alpha / lighten / darken / mix color operation signatures', () => {
    // #given
    const config = normalizeCssConfig({ colors: { primary: '#1677ff' } })

    // #when
    const dts = generateDts(config)

    // #then
    expect(dts).toContain('alpha(input: string, ratio: number): string')
    expect(dts).toContain('lighten(input: string, ratio: number): string')
    expect(dts).toContain('darken(input: string, ratio: number): string')
    expect(dts).toContain('mix(colorA: string, colorB: string, weight?: number): string')
  })
})
