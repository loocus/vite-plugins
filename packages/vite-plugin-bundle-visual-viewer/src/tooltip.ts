import type { HoverInfo } from './treemap'

const OFFSET_X = 14
const OFFSET_Y = 14
const MARGIN = 12

function formatBytes(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`
}

export function createTooltip(_container: HTMLElement): {
  show: (info: HoverInfo, x: number, y: number) => void
  hide: () => void
} {
  const panel = document.createElement('div')
  panel.className = 'detail-panel'
  panel.style.display = 'none'
  // Attach to body so it's not clipped by overflow:hidden on the container
  document.body.appendChild(panel)

  function position(x: number, y: number): void {
    const pw = panel.offsetWidth || 260
    const ph = panel.offsetHeight || 120
    const vw = window.innerWidth
    const vh = window.innerHeight

    const left = x + OFFSET_X + pw + MARGIN > vw ? x - pw - OFFSET_X : x + OFFSET_X
    const top = y + OFFSET_Y + ph + MARGIN > vh ? y - ph - OFFSET_Y : y + OFFSET_Y

    panel.style.left = `${left}px`
    panel.style.top = `${top}px`
  }

  function show(info: HoverInfo, x: number, y: number): void {
    const isDuplicated = !!info.duplicatedInChunks?.length

    panel.innerHTML = `
      <div class="detail-path">${info.id}</div>
      <div class="detail-rows">
        <div class="detail-row">
          <span class="detail-label">Size</span>
          <span class="detail-value">${formatBytes(info.value)}</span>
        </div>
        ${info.gzipSize !== undefined
          ? `<div class="detail-row">
              <span class="detail-label">Gzip</span>
              <span class="detail-value">${formatBytes(info.gzipSize)}</span>
            </div>`
          : ''}
        <div class="detail-row">
          <span class="detail-label">Of total</span>
          <span class="detail-value">${pct(info.totalRatio)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Of parent</span>
          <span class="detail-value">${pct(info.parentRatio)}</span>
        </div>
        ${isDuplicated
          ? `<div class="detail-row detail-row--warn">
              <span class="detail-label">Duplicated in</span>
              <span class="detail-value">${info.duplicatedInChunks!.join(', ')}</span>
            </div>`
          : ''}
        ${info.isOversized
          ? `<div class="detail-row detail-row--warn">
              <span class="detail-label">⚠ Oversized chunk</span>
              <span class="detail-value">exceeds limit</span>
            </div>`
          : ''}
      </div>
    `
    panel.style.display = 'block'
    position(x, y)
  }

  function hide(): void {
    panel.style.display = 'none'
  }

  return { show, hide }
}
