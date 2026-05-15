import type { ColorsInput, CssConfigInput, NormalizedColors, NormalizedCssConfig, NormalizedProps } from '../types'

function isPlainStringValue(value: unknown): value is string {
  return typeof value === 'string'
}

function extractLightColors(input: ColorsInput): Record<string, string> {
  const result: Record<string, string> = {}
  for (const key of Object.keys(input)) {
    if (key === 'dark')
      continue
    const value = input[key]
    if (isPlainStringValue(value))
      result[key] = value
  }
  return result
}

function extractDarkOverrides(input: ColorsInput): Record<string, string> {
  const darkInput = input.dark
  if (!darkInput)
    return {}
  const result: Record<string, string> = {}
  for (const key of Object.keys(darkInput)) {
    const value = darkInput[key]
    if (isPlainStringValue(value))
      result[key] = value
  }
  return result
}

function normalizeColors(input: ColorsInput | undefined): NormalizedColors {
  if (!input)
    return { tokens: [], light: {}, dark: {} }
  const light = extractLightColors(input)
  const darkOverrides = extractDarkOverrides(input)
  const dark: Record<string, string> = { ...light, ...darkOverrides }
  return {
    tokens: Object.keys(light),
    light,
    dark,
  }
}

function normalizeProps(input: Record<string, string> | undefined): NormalizedProps {
  if (!input)
    return { tokens: [], values: {} }
  const values: Record<string, string> = {}
  for (const key of Object.keys(input)) {
    const value = input[key]
    if (isPlainStringValue(value))
      values[key] = value
  }
  return {
    tokens: Object.keys(values),
    values,
  }
}

export function normalizeCssConfig(input: CssConfigInput, prefix: string = ''): NormalizedCssConfig {
  const colors = normalizeColors(input.colors)
  const props = normalizeProps(input.props)

  const cssVarName = (token: string): string => `--${prefix}${token}`
  const varExpr = (token: string): string => `var(${cssVarName(token)})`

  return {
    colors,
    props,
    prefix,
    cssVarName,
    varExpr,
  }
}
