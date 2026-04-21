import type { HierarchyRectangularNode } from 'd3-hierarchy'
import type { ZoomBehavior, ZoomTransform } from 'd3-zoom'
import type { BundleData, ModuleNode } from './types'
import { hierarchy, treemap, treemapBinary, treemapDice, treemapSlice, treemapSliceDice, treemapSquarify } from 'd3-hierarchy'
import { select } from 'd3-selection'
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom'
import 'd3-transition'

export type TileAlgorithm = 'squarify' | 'binary' | 'slice' | 'dice' | 'sliceDice'
export type SizeMode = 'raw' | 'gzip'
export type ColorMode = 'directory' | 'heatmap'

export interface HoverInfo {
  id: string
  label: string
  /** d3 computed value: sum of all descendant leaves */
  value: number
  gzipSize?: number
  duplicatedInChunks?: string[]
  totalRatio: number
  parentRatio: number
  isLeaf: boolean
  /** True when this is a chunk node exceeding the size warning limit */
  isOversized: boolean
}

const TILE_FNS = {
  squarify: treemapSquarify,
  binary: treemapBinary,
  slice: treemapSlice,
  dice: treemapDice,
  sliceDice: treemapSliceDice,
} as const

const HEADER_HEIGHT = 18
const FADE_DURATION = 150
const MIN_VISIBLE_PX = 1
const MIN_NODE_SIZE = 200
const DUPLICATE_COLOR = '#f97316'

function formatBytes(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function fitLabel(el: SVGTextElement, label: string, maxWidth: number): void {
  if (maxWidth <= 0) {
    el.textContent = ''
    return
  }
  // 先用字符宽度估算快速截断（避免循环 reflow）
  const avgCharWidth = 6.5
  const maxChars = Math.floor((maxWidth - 4) / avgCharWidth)
  const candidate = label.length > maxChars ? `${label.slice(0, Math.max(0, maxChars - 1))}…` : label
  el.textContent = candidate
  // 再用一次精确测量微调：如果估算结果仍然超出，逐字符向前收缩
  if (el.getComputedTextLength() <= maxWidth)
    return
  let text = candidate
  while (text.length > 1 && el.getComputedTextLength() > maxWidth) {
    text = `${text.slice(0, -2)}…`
    el.textContent = text
  }
}

/** Green → yellow → red based on ratio 0–1 */
function heatColor(ratio: number): string {
  const t = Math.max(0, Math.min(1, ratio))
  if (t <= 0.5) {
    const s = t * 2
    return `rgb(${Math.round(74 + 176 * s)},${Math.round(222 - 18 * s)},${Math.round(128 - 107 * s)})`
  }
  const s = (t - 0.5) * 2
  return `rgb(${Math.round(250 - 11 * s)},${Math.round(204 - 136 * s)},${Math.round(21 + 47 * s)})`
}

export class TreemapController {
  private readonly colorMap = new Map<string, string>()
  private readonly oversizedChunks: Set<string>

  private readonly svgEl: SVGSVGElement
  private readonly zoomGroupEl: SVGGElement
  private readonly zoomBehavior: ZoomBehavior<SVGSVGElement, unknown>

  private breadcrumb: ModuleNode[] = []
  private currentRootData: ModuleNode
  private tileAlgorithm: TileAlgorithm = 'squarify'
  private sizeMode: SizeMode = 'raw'
  private colorMode: ColorMode = 'directory'
  private transform: ZoomTransform = zoomIdentity
  private layoutRootValue = 1
  private filterQuery = ''

  private onBreadcrumbChange?: (path: ModuleNode[]) => void
  private onHover?: (info: HoverInfo | null, x: number, y: number) => void

  constructor(
    private readonly container: HTMLElement,
    data: BundleData,
  ) {
    this.currentRootData = data.root
    this.buildColorMap(data.root)

    const limit = data.meta.chunkSizeWarningLimit
    this.oversizedChunks = new Set(
      data.chunks.filter(c => c.size >= limit).map(c => c.fileName),
    )

    const { width, height } = this.getDimensions()

    const svgSel = select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('display', 'block')

    this.svgEl = svgSel.node()!

    const zoomGroupSel = svgSel.append('g').attr('class', 'zoom-group')
    this.zoomGroupEl = zoomGroupSel.node()!

    this.zoomBehavior = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 20])
      .on('zoom', (event: { transform: ZoomTransform }) => {
        this.transform = event.transform
        select(this.zoomGroupEl).attr('transform', event.transform.toString())
      })

    svgSel.call(this.zoomBehavior)
    this.renderNodes()
  }

  setOnBreadcrumbChange(cb: (path: ModuleNode[]) => void): void {
    this.onBreadcrumbChange = cb
  }

  setOnHover(cb: (info: HoverInfo | null, x: number, y: number) => void): void {
    this.onHover = cb
  }

  setTile(algo: TileAlgorithm): void {
    this.tileAlgorithm = algo
    this.fadeAndRender()
  }

  setSizeMode(mode: SizeMode): void {
    this.sizeMode = mode
    this.fadeAndRender()
  }

  setColorMode(mode: ColorMode): void {
    this.colorMode = mode
    this.fadeAndRender()
  }

  setFilter(query: string): void {
    this.filterQuery = query.toLowerCase().trim()
    this.renderNodes()
  }

  drillDown(nodeData: ModuleNode): void {
    if (!nodeData.children?.length)
      return
    this.breadcrumb.push(this.currentRootData)
    this.currentRootData = nodeData
    this.resetZoom()
    this.onBreadcrumbChange?.(this.getBreadcrumbPath())
    this.fadeAndRender()
  }

  drillTo(index: number): void {
    if (index >= this.breadcrumb.length)
      return
    this.currentRootData = this.breadcrumb[index]
    this.breadcrumb = this.breadcrumb.slice(0, index)
    this.resetZoom()
    this.onBreadcrumbChange?.(this.getBreadcrumbPath())
    this.fadeAndRender()
  }

  getBreadcrumbPath(): ModuleNode[] {
    return [...this.breadcrumb, this.currentRootData]
  }

  private getDimensions(): { width: number, height: number } {
    return { width: this.container.clientWidth, height: this.container.clientHeight }
  }

  private resetZoom(): void {
    this.transform = zoomIdentity
    select(this.svgEl).call(this.zoomBehavior.transform, zoomIdentity)
  }

  private buildColorMap(root: ModuleNode): void {
    const seeds: ModuleNode[] = []
    const chunks = root.children ?? [root]
    for (const chunk of chunks) {
      const chunkSeeds = chunk.children?.length ? chunk.children : [chunk]
      seeds.push(...chunkSeeds)
    }
    // Golden angle (137.508°) distributes hues with maximum perceptual separation
    seeds.forEach((seed, i) => {
      const hue = Math.round((i * 137.508) % 360)
      this.assignColor(seed, `hsl(${hue}, 68%, 52%)`)
    })
  }

  private assignColor(node: ModuleNode, color: string): void {
    this.colorMap.set(node.id, color)
    node.children?.forEach(child => this.assignColor(child, color))
  }

  private getDirectoryColor(nodeData: ModuleNode): string {
    return this.colorMap.get(nodeData.id) ?? `hsl(0, 0%, 50%)`
  }

  private computeLayout(): HierarchyRectangularNode<ModuleNode> {
    const { width, height } = this.getDimensions()

    const root = hierarchy<ModuleNode>(this.currentRootData)
      .sum(d => d.children ? 0 : Math.max(this.sizeMode === 'gzip' ? (d.gzipSize ?? d.size) : d.size, MIN_NODE_SIZE))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

    this.layoutRootValue = root.value ?? 1

    return treemap<ModuleNode>()
      .tile(TILE_FNS[this.tileAlgorithm])
      .size([width, height])
      .paddingOuter(4)
      .paddingInner(2)
      .paddingTop(d => (d.depth === 0 ? 0 : HEADER_HEIGHT))
      .round(true)(root)
  }

  private getVisibleDescendants(
    layoutRoot: HierarchyRectangularNode<ModuleNode>,
  ): HierarchyRectangularNode<ModuleNode>[] {
    const { width, height } = this.getDimensions()
    const { k: scale, x: tx, y: ty } = this.transform

    const vx0 = -tx / scale
    const vy0 = -ty / scale
    const vx1 = vx0 + width / scale
    const vy1 = vy0 + height / scale

    // 语义缩放：放大时降低最小可见阈值，让更小的节点显现
    const minPx = MIN_VISIBLE_PX / scale

    return layoutRoot.descendants().filter((d) => {
      if (d.depth === 0)
        return false
      const w = d.x1 - d.x0
      const h = d.y1 - d.y0
      if (w <= 0 || h <= 0)
        return false
      if (w * scale < minPx || h * scale < minPx)
        return false
      return d.x1 > vx0 && d.x0 < vx1 && d.y1 > vy0 && d.y0 < vy1
    })
  }

  private getFillColor(
    d: HierarchyRectangularNode<ModuleNode>,
    maxLeafValue: number,
    isInternal: boolean,
  ): string {
    if (d.data.duplicatedInChunks?.length)
      return isInternal ? `${DUPLICATE_COLOR}28` : DUPLICATE_COLOR

    if (this.colorMode === 'heatmap') {
      const ratio = maxLeafValue > 0 ? (d.value ?? 0) / maxLeafValue : 0
      const base = heatColor(ratio)
      return isInternal ? base.replace('rgb(', 'rgba(').replace(')', ', 0.15)') : base
    }

    // depth-based lightness: shallower = lighter, deeper = darker
    const base = this.getDirectoryColor(d.data)
    if (isInternal) {
      const lightness = Math.max(10, 18 - d.depth * 3)
      return base.replace('hsl(', 'hsla(').replace(')', `, ${lightness / 100})`)
    }
    // leaf: darken by depth for layering effect
    const lightAdj = Math.max(28, 52 - d.depth * 4)
    return base.replace(/,\s*52%/, `, ${lightAdj}%`)
  }

  private getAccentColor(d: HierarchyRectangularNode<ModuleNode>): string {
    if (d.data.duplicatedInChunks?.length)
      return DUPLICATE_COLOR
    if (this.colorMode === 'heatmap') {
      const ratio = this.layoutRootValue > 0 ? (d.value ?? 0) / this.layoutRootValue : 0
      return heatColor(ratio)
    }
    return this.getDirectoryColor(d.data)
  }

  private buildHoverInfo(d: HierarchyRectangularNode<ModuleNode>): HoverInfo {
    const value = d.value ?? 0
    const parentValue = d.parent?.value ?? this.layoutRootValue
    return {
      id: d.data.id,
      label: d.data.label,
      value,
      gzipSize: d.data.gzipSize,
      duplicatedInChunks: d.data.duplicatedInChunks,
      totalRatio: this.layoutRootValue > 0 ? value / this.layoutRootValue : 0,
      parentRatio: parentValue > 0 ? value / parentValue : 0,
      isLeaf: !d.data.children?.length,
      isOversized: d.depth === 1 && this.oversizedChunks.has(d.data.id),
    }
  }

  private fadeAndRender(): void {
    const zoomGroupSel = select(this.zoomGroupEl)
    zoomGroupSel
      .transition()
      .duration(FADE_DURATION)
      .style('opacity', '0')
      .on('end', () => {
        this.renderNodes()
        zoomGroupSel.transition().duration(FADE_DURATION).style('opacity', '1')
      })
  }

  renderNodes(): void {
    const layoutRoot = this.computeLayout()
    const nodes = this.getVisibleDescendants(layoutRoot)
    const maxLeafValue = Math.max(...layoutRoot.leaves().map(l => l.value ?? 0), 1)
    const q = this.filterQuery

    const zoomGroupSel = select(this.zoomGroupEl)
    zoomGroupSel.selectAll('*').remove()

    const internalNodes = nodes.filter(d => !!d.data.children?.length)
    const leafNodes = nodes.filter(d => !d.data.children?.length)

    const matchesFilter = (d: HierarchyRectangularNode<ModuleNode>): boolean =>
      !q || d.data.id.toLowerCase().includes(q) || d.data.label.toLowerCase().includes(q)

    // ── Internal nodes ──
    const internalCells = zoomGroupSel
      .selectAll<SVGGElement, HierarchyRectangularNode<ModuleNode>>('g.node-internal')
      .data(internalNodes, d => d.data.id)
      .join('g')
      .attr('class', 'node-internal')
      .attr('transform', d => `translate(${d.x0},${d.y0})`)
      .style('opacity', d => q && !matchesFilter(d) ? '0.2' : '1')
      .style('cursor', 'pointer')
      .on('click', (_e: MouseEvent, d) => this.drillDown(d.data))
      .on('mouseenter', (e: MouseEvent, d) => {
        select(e.currentTarget as SVGGElement)
          .append('rect')
          .attr('class', 'hover-overlay')
          .attr('width', Math.max(0, d.x1 - d.x0))
          .attr('height', Math.max(0, d.y1 - d.y0))
          .attr('fill', 'rgba(255,255,255,0.1)')
          .attr('pointer-events', 'none')
      })
      .on('mousemove', (e: MouseEvent, d) => {
        this.onHover?.(this.buildHoverInfo(d), e.clientX, e.clientY)
      })
      .on('mouseleave', (e: MouseEvent) => {
        select(e.currentTarget as SVGGElement).select('.hover-overlay').remove()
        this.onHover?.(null, 0, 0)
      })

    internalCells
      .append('rect')
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill', d => this.getFillColor(d, maxLeafValue, true))
      .attr('stroke', d => d.depth === 1 && this.oversizedChunks.has(d.data.id) ? '#fbbf24' : this.getAccentColor(d))
      .attr('stroke-width', d => d.depth === 1 && this.oversizedChunks.has(d.data.id) ? 2 : 1)

    internalCells
      .filter(d => d.y1 - d.y0 >= HEADER_HEIGHT)
      .append('rect')
      .attr('class', 'node-header')
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', HEADER_HEIGHT)
      .attr('fill', d => this.getAccentColor(d))
      .attr('opacity', 0.9)

    // ── Oversized chunk warning badge ──
    internalCells
      .filter(d => d.depth === 1 && this.oversizedChunks.has(d.data.id) && d.x1 - d.x0 > 24 && d.y1 - d.y0 >= HEADER_HEIGHT)
      .append('text')
      .attr('x', d => Math.max(0, d.x1 - d.x0) - 4)
      .attr('y', 13)
      .attr('font-size', '11px')
      .attr('fill', '#fbbf24')
      .attr('text-anchor', 'end')
      .attr('pointer-events', 'none')
      .text('⚠')

    internalCells
      .filter(d => d.x1 - d.x0 > 20 && d.y1 - d.y0 >= HEADER_HEIGHT)
      .append('text')
      .attr('x', 4)
      .attr('y', 13)
      .attr('font-size', '11px')
      .attr('fill', '#fff')
      .attr('pointer-events', 'none')
      .each(function (d) { fitLabel(this as SVGTextElement, d.data.label, d.x1 - d.x0 - 8) })

    // ── Leaf nodes ──
    const leafCells = zoomGroupSel
      .selectAll<SVGGElement, HierarchyRectangularNode<ModuleNode>>('g.node-leaf')
      .data(leafNodes, d => d.data.id)
      .join('g')
      .attr('class', 'node-leaf')
      .attr('transform', d => `translate(${d.x0},${d.y0})`)
      .style('opacity', d => q && !matchesFilter(d) ? '0.2' : '1')
      .on('mouseenter', (e: MouseEvent, d) => {
        select(e.currentTarget as SVGGElement)
          .append('rect')
          .attr('class', 'hover-overlay')
          .attr('width', Math.max(0, d.x1 - d.x0))
          .attr('height', Math.max(0, d.y1 - d.y0))
          .attr('fill', 'rgba(255,255,255,0.15)')
          .attr('pointer-events', 'none')
      })
      .on('mousemove', (e: MouseEvent, d) => {
        this.onHover?.(this.buildHoverInfo(d), e.clientX, e.clientY)
      })
      .on('mouseleave', (e: MouseEvent) => {
        select(e.currentTarget as SVGGElement).select('.hover-overlay').remove()
        this.onHover?.(null, 0, 0)
      })

    leafCells
      .append('rect')
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill', d => this.getFillColor(d, maxLeafValue, false))
      .attr('stroke', d => d.data.duplicatedInChunks?.length ? DUPLICATE_COLOR : 'rgba(0,0,0,0.25)')
      .attr('stroke-width', d => d.data.duplicatedInChunks?.length ? 1.5 : 0.5)

    leafCells
      .filter(d => d.x1 - d.x0 > 40 && d.y1 - d.y0 > 20)
      .append('text')
      .attr('x', 4)
      .attr('y', 14)
      .attr('font-size', '11px')
      .attr('fill', '#fff')
      .attr('pointer-events', 'none')
      .each(function (d) { fitLabel(this as SVGTextElement, d.data.label, d.x1 - d.x0 - 8) })

    leafCells
      .filter(d => d.x1 - d.x0 > 40 && d.y1 - d.y0 > 34)
      .append('text')
      .attr('x', 4)
      .attr('y', 28)
      .attr('font-size', '10px')
      .attr('fill', 'rgba(255,255,255,0.75)')
      .attr('pointer-events', 'none')
      .text((d) => {
        const size = this.sizeMode === 'gzip' ? (d.data.gzipSize ?? d.data.size) : d.data.size
        return formatBytes(size)
      })
  }
}
