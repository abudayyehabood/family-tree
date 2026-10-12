import { STORAGE_KEY } from './types'

// The /preview/ build saves under its own key, so trying it never touches the real tree.
export const IS_PREVIEW = import.meta.env.VITE_PREVIEW === '1'
export const ACTIVE_KEY = IS_PREVIEW ? `${STORAGE_KEY}_preview` : STORAGE_KEY
