import type { Measure } from '../layout/layout'

const ctx = document.createElement('canvas').getContext('2d')!

export const measureText: Measure = (text, font) => {
  ctx.font = font
  return ctx.measureText(text).width
}
