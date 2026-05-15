import { describe, expect, it } from 'vitest'
import { normalizeCssConfig } from '../plugin/normalize'
import { createSassImporter } from '../plugin/sass-importer'

describe('createSassImporter', () => {
  it('should canonicalize the virtual:css-props url', () => {
    // #given
    const config = normalizeCssConfig({ colors: { primary: '#1677ff' } })
    const importer = createSassImporter(() => config, true)

    // #when
    const url = importer.canonicalize('virtual:css-props')

    // #then
    expect(url).not.toBeNull()
    expect(url?.toString()).toBe('virtual:css-props')
  })

  it('should return null for unrelated urls', () => {
    // #given
    const importer = createSassImporter(() => normalizeCssConfig({}), true)

    // #when
    const url = importer.canonicalize('./regular.scss')

    // #then
    expect(url).toBeNull()
  })

  it('should load scss content for the canonical url', () => {
    // #given
    const config = normalizeCssConfig({ colors: { primary: '#1677ff' } })
    const importer = createSassImporter(() => config, true)

    // #when
    const result = importer.load(new URL('virtual:css-props'))

    // #then
    expect(result?.syntax).toBe('scss')
    expect(result?.contents).toContain('@function colorVar')
    expect(result?.contents).toContain('@function propVar')
  })

  it('should return null from load when config is not yet ready', () => {
    // #given
    const importer = createSassImporter(() => null, true)

    // #when
    const result = importer.load(new URL('virtual:css-props'))

    // #then
    expect(result).toBeNull()
  })

  it('should propagate strict flag to generateScss', () => {
    // #given
    const config = normalizeCssConfig({ colors: { primary: '#1677ff' } })
    const importer = createSassImporter(() => config, false)

    // #when
    const result = importer.load(new URL('virtual:css-props'))

    // #then
    expect(result?.contents).not.toContain('@error')
  })
})
