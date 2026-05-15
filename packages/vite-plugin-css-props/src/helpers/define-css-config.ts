import type { CssConfigInput } from '../types'

export function defineCssConfig<const T extends CssConfigInput>(config: T): T {
  return config
}
