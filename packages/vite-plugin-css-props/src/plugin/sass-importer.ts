import type { NormalizedCssConfig } from '../types'
import { generateScss } from './codegen-scss'

export const SASS_VIRTUAL_URL = 'virtual:css-props'

export interface SassImporterResult {
  contents: string
  syntax: 'scss' | 'indented' | 'css'
}

export interface SassImporter {
  canonicalize: (url: string) => URL | null
  load: (canonicalUrl: URL) => SassImporterResult | null
}

function isCssPropsImport(url: string): boolean {
  return url === SASS_VIRTUAL_URL || url === `${SASS_VIRTUAL_URL}.scss`
}

export function createSassImporter(
  getConfig: () => NormalizedCssConfig | null,
  strict: boolean,
): SassImporter {
  return {
    canonicalize(url) {
      if (!isCssPropsImport(url))
        return null
      return new URL(SASS_VIRTUAL_URL)
    },
    load(canonicalUrl) {
      if (canonicalUrl.toString() !== SASS_VIRTUAL_URL)
        return null
      const config = getConfig()
      if (!config)
        return null
      return {
        contents: generateScss(config, strict),
        syntax: 'scss',
      }
    },
  }
}
