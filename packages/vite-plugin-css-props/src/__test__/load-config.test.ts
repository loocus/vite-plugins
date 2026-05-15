import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadCssConfig, locateDefaultConfig, writeIfChanged } from '../plugin/load-config'

let workDir: string

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'css-props-load-config-'))
})

afterEach(() => {
  if (existsSync(workDir))
    rmSync(workDir, { recursive: true, force: true })
})

describe('loadCssConfig', () => {
  it('should return the inline config object when options.config is an object', async () => {
    // #given
    const inline = { colors: { primary: '#1677ff' } }

    // #when
    const result = await loadCssConfig({ config: inline }, workDir)

    // #then
    expect(result.config).toEqual(inline)
    expect(result.filePath).toBeNull()
  })

  it('should load config from a JSON file path passed via options.configFile', async () => {
    // #given
    const file = join(workDir, 'css.config.json')
    writeFileSync(file, JSON.stringify({ colors: { primary: '#1677ff' } }), 'utf8')

    // #when
    const result = await loadCssConfig({ configFile: 'css.config.json' }, workDir)

    // #then
    expect(result.config).toEqual({ colors: { primary: '#1677ff' } })
    expect(result.filePath).toBe(file)
  })

  it('should auto-discover default css.config.json at project root', async () => {
    // #given
    writeFileSync(join(workDir, 'css.config.json'), JSON.stringify({ props: { spacingMd: '16px' } }))

    // #when
    const result = await loadCssConfig({}, workDir)

    // #then
    expect(result.config).toEqual({ props: { spacingMd: '16px' } })
    expect(result.filePath).toMatch(/css\.config\.json$/)
  })

  it('should return empty config when no source is provided and none discovered', async () => {
    // #when
    const result = await loadCssConfig({}, workDir)

    // #then
    expect(result.config).toEqual({})
    expect(result.filePath).toBeNull()
  })

  it('should throw when explicit configFile path does not exist', async () => {
    // #when / #then
    await expect(loadCssConfig({ configFile: 'missing.json' }, workDir))
      .rejects
      .toThrow(/config file not found/)
  })
})

describe('locateDefaultConfig', () => {
  it('should pick the first matching default name', () => {
    // #given
    writeFileSync(join(workDir, 'css.config.json'), '{}')

    // #when
    const path = locateDefaultConfig(workDir)

    // #then
    expect(path).toMatch(/css\.config\.json$/)
  })

  it('should return null when no default config file exists', () => {
    // #when
    const path = locateDefaultConfig(workDir)

    // #then
    expect(path).toBeNull()
  })
})

describe('writeIfChanged', () => {
  it('should write and return true when file does not exist', () => {
    // #given
    const target = join(workDir, 'out.txt')

    // #when
    const changed = writeIfChanged(target, 'hello')

    // #then
    expect(changed).toBe(true)
    expect(existsSync(target)).toBe(true)
  })

  it('should skip writing and return false when content is identical', () => {
    // #given
    const target = join(workDir, 'out.txt')
    writeFileSync(target, 'same')

    // #when
    const changed = writeIfChanged(target, 'same')

    // #then
    expect(changed).toBe(false)
  })

  it('should overwrite when content differs', () => {
    // #given
    const target = join(workDir, 'out.txt')
    writeFileSync(target, 'old')

    // #when
    const changed = writeIfChanged(target, 'new')

    // #then
    expect(changed).toBe(true)
  })
})
