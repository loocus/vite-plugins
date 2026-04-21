import type { BundleData } from './types'
import { createBreadcrumb, createColorModeToggle, createSearchInput, createSizeToggle, createTileSwitcher } from './controls'
import { createTooltip } from './tooltip'
import { TreemapController } from './treemap'
import './style.css'

function formatBytes(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function sep(toolbar: HTMLElement): void {
  const el = document.createElement('div')
  el.className = 'toolbar-sep'
  toolbar.appendChild(el)
}

function init(): void {
  const data: BundleData = window.__BUNDLE_DATA__

  const app = document.getElementById('app')
  if (!app)
    throw new Error('[bundle-visual] #app container not found')

  // ── Toolbar ──
  const toolbar = document.createElement('div')
  toolbar.className = 'toolbar'

  const title = document.createElement('h1')
  title.textContent = 'Bundle Visual'
  toolbar.appendChild(title)

  const metaEl = document.createElement('span')
  metaEl.className = 'meta'
  metaEl.textContent = formatBytes(data.meta.totalSize)
  toolbar.appendChild(metaEl)

  sep(toolbar)

  const breadcrumbWrap = document.createElement('div')
  breadcrumbWrap.style.cssText = 'flex:1;min-width:0'
  toolbar.appendChild(breadcrumbWrap)

  sep(toolbar)

  app.appendChild(toolbar)

  // ── Treemap container ──
  const treemapContainer = document.createElement('div')
  treemapContainer.className = 'treemap-container'
  app.appendChild(treemapContainer)

  // ── Controller ──
  const controller = new TreemapController(treemapContainer, data)

  // ── Breadcrumb ──
  const breadcrumb = createBreadcrumb(breadcrumbWrap, index => controller.drillTo(index))
  breadcrumb.update(controller.getBreadcrumbPath())
  controller.setOnBreadcrumbChange(path => breadcrumb.update(path))

  // ── Tile switcher ──
  createTileSwitcher(toolbar, 'squarify', algo => controller.setTile(algo))

  sep(toolbar)

  // ── Size toggle ──
  const hasGzip = data.meta.totalGzipSize !== undefined
  if (hasGzip) {
    createSizeToggle(toolbar, 'raw', mode => controller.setSizeMode(mode))
    sep(toolbar)
  }

  // ── Color mode toggle ──
  createColorModeToggle(toolbar, 'directory', mode => controller.setColorMode(mode))

  sep(toolbar)

  // ── Search ──
  createSearchInput(toolbar, query => controller.setFilter(query))

  // ── Detail panel ──
  const tooltip = createTooltip(treemapContainer)
  controller.setOnHover((info, x, y) => info ? tooltip.show(info, x, y) : tooltip.hide())
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
}
else {
  init()
}
