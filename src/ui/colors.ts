// One colour per generation. Neighbours are far apart on the colour wheel
// (checked by test/colors.test.ts), all dark enough for white text.
export const GEN_COLORS = [
  '#78350f', // 1 brown (the founder)
  '#0f766e', // 2 teal
  '#b91c1c', // 3 red
  '#1d4ed8', // 4 blue
  '#a16207', // 5 ochre
  '#7e22ce', // 6 purple
  '#15803d', // 7 green
  '#be185d', // 8 pink
  '#0369a1', // 9 sky
  '#c2410c', // 10 orange
  '#4338ca', // 11 indigo
  '#4d7c0f', // 12 olive
  '#a21caf', // 13 magenta
  '#047857', // 14 emerald
  '#334155', // 15 slate
]

export const genColor = (g: number) => GEN_COLORS[(g - 1) % GEN_COLORS.length]

// Mix toward white: t = 0 keeps the colour, 1 is white.
export function tint(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * t))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

export function hue(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => v / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (!d) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}
