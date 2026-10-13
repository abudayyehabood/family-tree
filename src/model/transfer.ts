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

// Takes our export file, and also the raw backup from the error screen
// (the saved data as it was: a bare root, or { root }).
export function importJson(text: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    return { ok: false, errors: ['the file is not valid JSON'] }
  }
  if (typeof parsed !== 'object' || parsed === null) return { ok: false, errors: ['the file is not a family tree'] }
  const f = parsed as Record<string, unknown>
  let root: unknown
  if ('app' in f) {
    if (f.app !== 'arabic-family-tree') return { ok: false, errors: ['the file is not an arabic-family-tree export'] }
    if (f.version !== 1) return { ok: false, errors: [`unsupported file version: ${String(f.version)}`] }
    root = f.root
  } else root = 'type' in f || !('root' in f) ? f : f.root
  const { errors, warnings } = validateTree(root)
  if (errors.length) return { ok: false, errors }
  return { ok: true, root: root as TreeNode, warnings }
}

function exportFile(root: TreeNode): File {
  return new File([exportJson(root)], `family-tree-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' })
}

export function downloadJson(root: TreeNode): void {
  const file = exportFile(root)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// Phones: send the file straight to WhatsApp, mail, Files...
export const CAN_SHARE = typeof navigator !== 'undefined' &&
  !!navigator.canShare?.({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] })

export async function shareJson(root: TreeNode): Promise<void> {
  try {
    await navigator.share({ files: [exportFile(root)], title: 'شجرة العائلة' })
  } catch (e) {
    if ((e as Error).name !== 'AbortError') downloadJson(root) // cancelled is fine; anything else: just download
  }
}
