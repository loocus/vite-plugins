export type ColorValue = string

export type PropValue = string

export type ThemeName = 'light' | 'dark'

export interface ColorsInput {
  [token: string]: ColorValue | Partial<Record<string, ColorValue>> | undefined
  dark?: Partial<Record<string, ColorValue>>
}

export interface CssConfigInput {
  colors?: ColorsInput
  props?: Record<string, PropValue>
}

export interface DtsOptions {
  enabled?: boolean
  outFile?: string
}

export interface ScssOptions {
  strict?: boolean
}

export interface PluginOptions {
  config?: CssConfigInput | string
  configFile?: string
  prefix?: string
  darkSelector?: string
  dts?: DtsOptions
  scss?: ScssOptions
}

export interface NormalizedColors {
  tokens: readonly string[]
  light: Readonly<Record<string, string>>
  dark: Readonly<Record<string, string>>
}

export interface NormalizedProps {
  tokens: readonly string[]
  values: Readonly<Record<string, string>>
}

export interface NormalizedCssConfig {
  colors: NormalizedColors
  props: NormalizedProps
  prefix: string
  cssVarName: (token: string) => string
  varExpr: (token: string) => string
}
