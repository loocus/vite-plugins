import { describe, expect, it } from 'vitest'
import { createColorOps } from '../runtime/color-ops'

describe('createColorOps', () => {
  describe('alpha', () => {
    it('should emit color-mix when input contains var()', () => {
      // #given
      const { alpha } = createColorOps()

      // #when
      const result = alpha('var(--primary)', 0.6)

      // #then
      expect(result).toBe('color-mix(in oklch, var(--primary) 60%, transparent)')
    })

    it('should emit color-mix when input is already a color-mix expression', () => {
      // #given
      const { alpha } = createColorOps()

      // #when
      const result = alpha('color-mix(in oklch, var(--p) 50%, transparent)', 0.5)

      // #then
      expect(result).toBe('color-mix(in oklch, color-mix(in oklch, var(--p) 50%, transparent) 50%, transparent)')
    })

    it('should compute rgba via colord when input is hex literal', () => {
      // #given
      const { alpha } = createColorOps()

      // #when
      const result = alpha('#1677ff', 0.6)

      // #then
      expect(result).toBe('rgba(22, 119, 255, 0.6)')
    })

    it('should set alpha to absolute value (not delta) on hex with existing alpha', () => {
      // #given
      const { alpha } = createColorOps()

      // #when
      const result = alpha('rgba(22, 119, 255, 0.2)', 0.8)

      // #then
      expect(result).toBe('rgba(22, 119, 255, 0.8)')
    })

    it('should produce fully transparent result at ratio 0', () => {
      // #given
      const { alpha } = createColorOps()

      // #when
      const result = alpha('#1677ff', 0)

      // #then
      expect(result).toBe('rgba(22, 119, 255, 0)')
    })
  })

  describe('lighten', () => {
    it('should emit color-mix toward white for var input', () => {
      // #given
      const { lighten } = createColorOps()

      // #when
      const result = lighten('var(--primary)', 0.1)

      // #then
      expect(result).toBe('color-mix(in oklch, white 10%, var(--primary))')
    })

    it('should mix with white via colord for hex literal', () => {
      // #given
      const { lighten } = createColorOps()

      // #when
      const result = lighten('#1677ff', 0.5)

      // #then
      expect(result).toMatch(/^#[0-9a-f]{6}$/)
      expect(result).not.toBe('#1677ff')
    })
  })

  describe('darken', () => {
    it('should emit color-mix toward black for var input', () => {
      // #given
      const { darken } = createColorOps()

      // #when
      const result = darken('var(--primary)', 0.2)

      // #then
      expect(result).toBe('color-mix(in oklch, black 20%, var(--primary))')
    })

    it('should mix with black via colord for hex literal', () => {
      // #given
      const { darken } = createColorOps()

      // #when
      const result = darken('#ffffff', 0.5)

      // #then
      expect(result).toMatch(/^#[0-9a-f]{6}$/)
      expect(result).not.toBe('#ffffff')
    })
  })

  describe('mix', () => {
    it('should default weight to 0.5 when omitted', () => {
      // #given
      const { mix } = createColorOps()

      // #when
      const result = mix('var(--a)', 'var(--b)')

      // #then
      expect(result).toBe('color-mix(in oklch, var(--a) 50%, var(--b))')
    })

    it('should emit color-mix when both inputs are var', () => {
      // #given
      const { mix } = createColorOps()

      // #when
      const result = mix('var(--a)', 'var(--b)', 0.3)

      // #then
      expect(result).toBe('color-mix(in oklch, var(--a) 30%, var(--b))')
    })

    it('should fall back to color-mix when only one side is a CSS expression', () => {
      // #given
      const { mix } = createColorOps()

      // #when
      const result = mix('var(--a)', '#ffffff', 0.4)

      // #then
      expect(result).toBe('color-mix(in oklch, var(--a) 40%, #ffffff)')
    })

    it('should compute hex via colord when both sides are literals', () => {
      // #given
      const { mix } = createColorOps()

      // #when
      const result = mix('#000000', '#ffffff', 0.5)

      // #then
      expect(result).toMatch(/^#[0-9a-f]{6}$/)
    })
  })

  describe('nested calls', () => {
    it('should emit nested color-mix when composing var-rooted operations', () => {
      // #given
      const { alpha, lighten } = createColorOps()

      // #when
      const result = lighten(alpha('var(--primary)', 0.5), 0.1)

      // #then
      expect(result).toBe('color-mix(in oklch, white 10%, color-mix(in oklch, var(--primary) 50%, transparent))')
    })
  })
})
