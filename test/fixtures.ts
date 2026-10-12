import { generateTree, type Shape } from '../src/synthetic/generator'

// Every layout rule is checked on all of these. Synthetic only.
export const SIZES = [50, 300, 800, 1500]
export const SHAPES: Shape[] = ['deep', 'wide']

export const CASES = SIZES.flatMap((size) =>
  SHAPES.map((shape) => ({ name: `${shape}-${size}`, size, shape, root: generateTree({ size, shape, seed: size }) })),
)
