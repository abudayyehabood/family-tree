export type NodeType = 'member' | 'wife'

export interface TreeNode {
  id: string
  type: NodeType // 'member' = blood relative, 'wife' = a man's wife
  name: string
  gender: 'male' | 'female' // wives always 'female'
  generation: number // founder = 1; a wife shares her husband's generation
  collapsed?: boolean
  unknown?: boolean // placeholder wife when the mother's name is unknown
  born?: number
  died?: number
  husband?: string // daughters only: a text tag, never a branch
  children: TreeNode[]
}

export const STORAGE_KEY = 'organic_family_tree_v3'
export const UNKNOWN_WIFE_NAME = 'غير معروفة'
export const MAX_WIVES = 4
export const MAX_GENERATIONS = 15

export interface ExportFile {
  app: 'arabic-family-tree'
  version: 1
  exportedAt: string
  root: TreeNode
}
