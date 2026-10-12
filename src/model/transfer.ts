import type { ExportFile, TreeNode } from './types'
import { validateTree } from './validate'

export function toExportFile(root: TreeNode, now = new Date()): ExportFile {
  return { app: 'arabic-family-tree', version: 1, exportedAt: now.toISOString(), root }
}

export function exportJson(root: TreeNode, now = new Date()): string {
  return JSON.stringify(toExportFile(root, now), null, 2)
}

export type ImportResult =
  | { ok: true; root: TreeNode; warnings: string[] }
  | { ok: false; errors: string[] }

export function importJson(text: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, errors: ['the file is not valid JSON'] }
  }
  if (typeof parsed !== 'object' || parsed === null) return { ok: false, errors: ['the file is not a family tree'] }
  const f = parsed as Partial<ExportFile>
  if (f.app !== 'arabic-family-tree') return { ok: false, errors: ['the file is not an arabic-family-tree export'] }
  if (f.version !== 1) return { ok: false, errors: [`unsupported file version: ${String(f.version)}`] }
  const { errors, warnings } = validateTree(f.root)
  if (errors.length) return { ok: false, errors }
  return { ok: true, root: f.root as TreeNode, warnings }
}

export function downloadJson(root: TreeNode): void {
  const blob = new Blob([exportJson(root)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `family-tree-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
