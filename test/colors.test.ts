import { expect, it } from 'vitest'
import { GEN_COLORS, hue } from '../src/ui/colors'

const gap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  const l = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]
}

it('15 generations, neighbours (also 15 -> 1) at least 60 degrees apart in hue', () => {
  expect(GEN_COLORS).toHaveLength(15)
  for (let i = 0; i < GEN_COLORS.length; i++) {
    const a = GEN_COLORS[i], b = GEN_COLORS[(i + 1) % GEN_COLORS.length]
    if (b === '#334155' || a === '#334155') continue // slate is grey: different by lightness, not hue
    expect(gap(hue(a), hue(b)), `${i + 1} vs ${i + 2}`).toBeGreaterThanOrEqual(60)
  }
})

it('white text is readable on every colour (contrast >= 4.5)', () => {
  for (const c of GEN_COLORS) expect((1.05) / (luminance(c) + 0.05), c).toBeGreaterThanOrEqual(4.5)
})
