// @env node
import type { BundleData } from './types'
import template from 'vite-plugin-bundle-visual-viewer/template?raw'

const PLACEHOLDER = '__BUNDLE_DATA_PLACEHOLDER__'

export function injectBundleData(data: BundleData): string {
  return template.replace(PLACEHOLDER, () => JSON.stringify(data))
}
