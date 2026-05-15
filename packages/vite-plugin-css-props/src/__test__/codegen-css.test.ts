import { describe, expect, it } from 'vitest'
import { generateCss } from '../plugin/codegen-css'
import { normalizeCssConfig } from '../plugin/normalize'

describe('generateCss', () => {
  it('should emit :root declarations for all light color tokens', () => {
    // #given
    const config = normalizeCssConfig({
      colors: { primary: '#1677ff', success: '#52c41a' },
    })

    // #when
    const css = generateCss(config, '.dark')

    // #then
    expect(css).toContain(':root {')
    expect(css).toContain('--primary: #1677ff;')
    expect(css).toContain('--success: #52c41a;')
  })

  it('should emit :root declarations for all props within the light block', () => {
    // #given
    const config = normalizeCssConfig({
      props: { spacingMd: '16px', radiusLg: '12px' },
    })

    // #when
    const css = generateCss(config, '.dark')

    // #then
    expect(css).toContain('--spacingMd: 16px;')
    expect(css).toContain('--radiusLg: 12px;')
  })

  it('should emit dark selector block with only overridden color tokens', () => {
    // #given
    const config = normalizeCssConfig({
      colors: {
        primary: '#1677ff',
        bg: '#fff',
        dark: { primary: '#4096ff' },
      },
    })

    // #when
    const css = generateCss(config, '.dark')

    // #then
    expect(css).toContain('.dark {')
    expect(css).toContain('--primary: #4096ff;')
    expect(css).not.toMatch(/\.dark \{[^}]*--bg/)
  })

  it('should not emit dark block for prop tokens since props have no dark variant', () => {
    // #given
    const config = normalizeCssConfig({
      colors: { primary: '#1677ff', dark: { primary: '#4096ff' } },
      props: { spacingMd: '16px' },
    })

    // #when
    const css = generateCss(config, '.dark')

    // #then
    expect(css).not.toMatch(/\.dark \{[^}]*--spacingMd/)
  })

  it('should omit dark selector block when no color overrides exist', () => {
    // #given
    const config = normalizeCssConfig({ colors: { primary: '#1677ff' } })

    // #when
    const css = generateCss(config, '.dark')

    // #then
    expect(css).not.toContain('.dark {')
  })

  it('should respect custom dark selector', () => {
    // #given
    const config = normalizeCssConfig({
      colors: { primary: '#1677ff', dark: { primary: '#4096ff' } },
    })

    // #when
    const css = generateCss(config, '[data-theme="dark"]')

    // #then
    expect(css).toContain('[data-theme="dark"] {')
  })

  it('should prepend prefix to all css variable names', () => {
    // #given
    const config = normalizeCssConfig({
      colors: { primary: '#1677ff' },
      props: { spacingMd: '16px' },
    }, 'app-')

    // #when
    const css = generateCss(config, '.dark')

    // #then
    expect(css).toContain('--app-primary: #1677ff;')
    expect(css).toContain('--app-spacingMd: 16px;')
  })
})
