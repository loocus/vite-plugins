// @env node
import type { BundleData } from './types'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const PLACEHOLDER = '__BUNDLE_DATA_PLACEHOLDER__'

function loadTemplate(): string {
  const templatePath = require.resolve('vite-plugin-bundle-visual-viewer/template')
  return readFileSync(templatePath, 'utf8')
}

export function injectBundleData(data: BundleData): string {
  return loadTemplate().replace(PLACEHOLDER, () => JSON.stringify(data))
}
