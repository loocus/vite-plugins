import type { ColorMode, SizeMode, TileAlgorithm } from './treemap'
import type { ModuleNode } from './types'

const TILE_LABELS: Record<TileAlgorithm, string> = {
  squarify: 'Squarify',
  binary: 'Binary',
  slice: 'Slice',
  dice: 'Dice',
  sliceDice: 'Slice-Dice',
}

export function createBreadcrumb(
  container: HTMLElement,
  onNavigate: (index: number) => void,
): { update: (path: ModuleNode[]) => void } {
  const el = document.createElement('nav')
  el.className = 'breadcrumb'
  container.appendChild(el)

  function update(path: ModuleNode[]): void {
    el.innerHTML = ''
    path.forEach((node, index) => {
      const isLast = index === path.length - 1

      const item = document.createElement('span')
      item.className = `breadcrumb-item${isLast ? ' breadcrumb-item--active' : ''}`
      item.textContent = node.label
      if (!isLast)
        item.addEventListener('click', () => onNavigate(index))
      el.appendChild(item)

      if (!isLast) {
        const sep = document.createElement('span')
        sep.className = 'breadcrumb-sep'
        sep.textContent = '/'
        el.appendChild(sep)
      }
    })
  }

  return { update }
}

export function createTileSwitcher(
  container: HTMLElement,
  current: TileAlgorithm,
  onSwitch: (algo: TileAlgorithm) => void,
): { setActive: (algo: TileAlgorithm) => void } {
  const wrapper = document.createElement('div')
  wrapper.className = 'select-wrapper'

  const label = document.createElement('span')
  label.className = 'select-label'
  label.textContent = 'Tile'

  const select = document.createElement('select')
  select.className = 'toolbar-select'

  for (const [algo, text] of Object.entries(TILE_LABELS) as [TileAlgorithm, string][]) {
    const opt = document.createElement('option')
    opt.value = algo
    opt.textContent = text
    opt.selected = algo === current
    select.appendChild(opt)
  }

  select.addEventListener('change', () => onSwitch(select.value as TileAlgorithm))

  wrapper.appendChild(label)
  wrapper.appendChild(select)
  container.appendChild(wrapper)

  function setActive(algo: TileAlgorithm): void {
    select.value = algo
  }

  return { setActive }
}

export function createSizeToggle(
  container: HTMLElement,
  current: SizeMode,
  onChange: (mode: SizeMode) => void,
): { setActive: (mode: SizeMode) => void } {
  const el = document.createElement('div')
  el.className = 'btn-group'

  const modes: SizeMode[] = ['raw', 'gzip']
  const labels: Record<SizeMode, string> = { raw: 'Raw', gzip: 'Gzip' }
  const buttons = new Map<SizeMode, HTMLButtonElement>()

  for (const mode of modes) {
    const btn = document.createElement('button')
    btn.className = `group-btn${mode === current ? ' group-btn--active' : ''}`
    btn.textContent = labels[mode]
    btn.addEventListener('click', () => {
      onChange(mode)
      setActive(mode)
    })
    buttons.set(mode, btn)
    el.appendChild(btn)
  }

  container.appendChild(el)

  function setActive(mode: SizeMode): void {
    buttons.forEach((btn, key) => btn.classList.toggle('group-btn--active', key === mode))
  }

  return { setActive }
}

export function createSearchInput(
  container: HTMLElement,
  onSearch: (query: string) => void,
): void {
  const wrapper = document.createElement('div')
  wrapper.className = 'search-wrapper'

  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = 'Filter modules…'
  input.className = 'search-input'
  input.addEventListener('input', () => onSearch(input.value))

  wrapper.appendChild(input)
  container.appendChild(wrapper)
}

export function createColorModeToggle(
  container: HTMLElement,
  current: ColorMode,
  onChange: (mode: ColorMode) => void,
): { setActive: (mode: ColorMode) => void } {
  const el = document.createElement('div')
  el.className = 'btn-group'

  const configs: { mode: ColorMode, label: string, icon: string }[] = [
    { mode: 'directory', label: 'Dir', icon: '📁' },
    { mode: 'heatmap', label: 'Heat', icon: '🌡' },
  ]
  const buttons = new Map<ColorMode, HTMLButtonElement>()

  for (const { mode, label, icon } of configs) {
    const btn = document.createElement('button')
    btn.className = `group-btn group-btn--color-mode${mode === current ? ' group-btn--active' : ''}`
    btn.innerHTML = `<span class="btn-icon">${icon}</span>${label}`
    btn.addEventListener('click', () => {
      onChange(mode)
      setActive(mode)
    })
    buttons.set(mode, btn)
    el.appendChild(btn)
  }

  container.appendChild(el)

  function setActive(mode: ColorMode): void {
    buttons.forEach((btn, key) => btn.classList.toggle('group-btn--active', key === mode))
  }

  return { setActive }
}
