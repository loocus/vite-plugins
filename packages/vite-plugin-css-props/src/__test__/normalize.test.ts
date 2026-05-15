import { describe, expect, it } from 'vitest'
import { normalizeCssConfig } from '../plugin/normalize'

describe('normalizeCssConfig', () => {
  it('should extract light color tokens from colors block', () => {
    // #given
    const input = { colors: { primary: '#1677ff', success: '#52c41a' } }

    // #when
    const result = normalizeCssConfig(input)

    // #then
    expect(result.colors.tokens).toEqual(['primary', 'success'])
    expect(result.colors.light).toEqual({ primary: '#1677ff', success: '#52c41a' })
  })

  it('should merge color dark overrides on top of light values', () => {
    // #given
    const input = {
      colors: {
        primary: '#1677ff',
        bg: '#fff',
        dark: { primary: '#4096ff' },
      },
    }

    // #when
    const result = normalizeCssConfig(input)

    // #then
    expect(result.colors.dark).toEqual({ primary: '#4096ff', bg: '#fff' })
  })

  it('should fall back to light value when dark omits a color token', () => {
    // #given
    const input = {
      colors: { primary: '#1677ff', bg: '#fff', dark: { primary: '#4096ff' } },
    }

    // #when
    const result = normalizeCssConfig(input)

    // #then
    expect(result.colors.dark.bg).toBe('#fff')
  })

  it('should ignore non-string color values except dark block', () => {
    // #given
    const input = {
      colors: {
        primary: '#1677ff',
        dark: { primary: '#4096ff' },
        junk: 42 as unknown as string,
      },
    }

    // #when
    const result = normalizeCssConfig(input)

    // #then
    expect(result.colors.tokens).toEqual(['primary'])
  })

  it('should extract prop values from props block', () => {
    // #given
    const input = { props: { spacingMd: '16px', radiusLg: '12px' } }

    // #when
    const result = normalizeCssConfig(input)

    // #then
    expect(result.props.tokens).toEqual(['spacingMd', 'radiusLg'])
    expect(result.props.values).toEqual({ spacingMd: '16px', radiusLg: '12px' })
  })

  it('should keep props isolated from colors', () => {
    // #given
    const input = {
      colors: { primary: '#1677ff' },
      props: { spacingMd: '16px' },
    }

    // #when
    const result = normalizeCssConfig(input)

    // #then
    expect(result.colors.tokens).toEqual(['primary'])
    expect(result.props.tokens).toEqual(['spacingMd'])
  })

  it('should apply prefix to css var name and var expression', () => {
    // #given
    const input = { colors: { primary: '#1677ff' }, props: { spacingMd: '16px' } }

    // #when
    const result = normalizeCssConfig(input, 'app-')

    // #then
    expect(result.cssVarName('primary')).toBe('--app-primary')
    expect(result.varExpr('spacingMd')).toBe('var(--app-spacingMd)')
  })

  it('should handle empty config without throwing', () => {
    // #given
    const input = {}

    // #when
    const result = normalizeCssConfig(input)

    // #then
    expect(result.colors.tokens).toEqual([])
    expect(result.props.tokens).toEqual([])
  })
})
