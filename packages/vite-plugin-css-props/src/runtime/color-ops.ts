import { colord, extend } from 'colord'
import mixPlugin from 'colord/plugins/mix'

extend([mixPlugin])

export interface ColorOps {
  /**
   * Set absolute alpha on a color.
   * - var/color-mix input → `color-mix(in oklch, ${input} ${ratio*100}%, transparent)`
   * - literal input → `rgba(...)` via colord
   */
  alpha: (input: string, ratio: number) => string
  /**
   * Mix the input towards white by `ratio` (0 to 1).
   */
  lighten: (input: string, ratio: number) => string
  /**
   * Mix the input towards black by `ratio` (0 to 1).
   */
  darken: (input: string, ratio: number) => string
  /**
   * Mix two colors. `weight` is the proportion of `colorA` (default 0.5).
   * If either side is a CSS expression (var/color-mix), the whole result
   * goes through CSS `color-mix` to preserve runtime resolution.
   */
  mix: (colorA: string, colorB: string, weight?: number) => string
}

const isCssExpr = (s: string): boolean => /var\(|color-mix\(/.test(s)

const toPercent = (ratio: number): string => `${ratio * 100}%`

function cssMix(a: string, weightA: number, b: string): string {
  return `color-mix(in oklch, ${a} ${toPercent(weightA)}, ${b})`
}

function alpha(input: string, ratio: number): string {
  if (isCssExpr(input))
    return `color-mix(in oklch, ${input} ${toPercent(ratio)}, transparent)`
  return colord(input).alpha(ratio).toRgbString()
}

function lighten(input: string, ratio: number): string {
  if (isCssExpr(input))
    return cssMix('white', ratio, input)
  return colord(input).mix('#ffffff', ratio).toHex()
}

function darken(input: string, ratio: number): string {
  if (isCssExpr(input))
    return cssMix('black', ratio, input)
  return colord(input).mix('#000000', ratio).toHex()
}

function mix(colorA: string, colorB: string, weight: number = 0.5): string {
  if (isCssExpr(colorA) || isCssExpr(colorB))
    return cssMix(colorA, weight, colorB)
  return colord(colorA).mix(colorB, 1 - weight).toHex()
}

export function createColorOps(): ColorOps {
  return { alpha, lighten, darken, mix }
}
