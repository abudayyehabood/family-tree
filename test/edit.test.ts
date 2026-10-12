import { describe, expect, it } from 'vitest'
import {
  addChild, addWife, countSubtree, deletePerson, findNode, hiddenCount, pathTo, reveal, setCollapsed, updatePerson,
} from '../src/model/mutations'
import { commit, redo, startHistory, undo } from '../src/model/history'
import { normalize, search } from '../src/search/normalize'
import { validateTree } from '../src/model/validate'
import { generateTree } from '../src/synthetic/generator'
import type { TreeNode } from '../src/model/types'

const founder = (): TreeNode => ({ id: 'f', type: 'member', name: 'جد', gender: 'male', generation: 1, children: [] })
const clean = (t: TreeNode) => expect(validateTree(t)).toEqual({ errors: [], warnings: [] })

describe('editing', () => {
  it('a son of a man with no wife gets an unknown mother', () => {
    const { root, id } = addChild(founder(), 'f', 'male', 'ابن')
    clean(root)
    const path = pathTo(root, id)!
    expect(path[1]).toMatchObject({ type: 'wife', unknown: true })
    expect(findNode(root, id)!.generation).toBe(2)
  })

  it('with one wife the child goes under her; with two you must choose', () => {
    let r = addWife(founder(), 'f', 'زوجة').root
    r = addChild(r, 'f', 'female', 'بنت').root
    expect(r.children[0].children).toHaveLength(1)
    r = addWife(r, 'f', 'زوجة ثانية').root
    expect(() => addChild(r, 'f', 'male', 'ابن')).toThrow(/mother/)
    r = addChild(r, 'f', 'male', 'ابن', r.children[1].id).root
    expect(r.children[1].children[0].name).toBe('ابن')
    clean(r)
  })

  it('at most 4 wives, and daughters get no children', () => {
    let r = founder()
    for (let i = 0; i < 4; i++) r = addWife(r, 'f', `ز${i}`).root
    expect(() => addWife(r, 'f', 'خامسة')).toThrow()
    const d = addChild(r, r.children[0].id, 'female', 'بنت')
    expect(() => addChild(d.root, d.id, 'male', 'x')).toThrow()
  })

  it('edits name, years, husband tag; empty years are removed', () => {
    let r = addChild(founder(), 'f', 'female', 'بنت')
    let t = updatePerson(r.root, r.id, { name: ' سارة ', born: 1950, died: 2000, husband: 'أحمد' })
    expect(findNode(t, r.id)).toMatchObject({ name: 'سارة', born: 1950, died: 2000, husband: 'أحمد' })
    t = updatePerson(t, r.id, { died: null, husband: '' })
    expect(findNode(t, r.id)!.died).toBeUndefined()
    expect(findNode(t, r.id)!.husband).toBeUndefined()
    clean(t)
  })

  it('a man with wives cannot be turned into a daughter', () => {
    const r = addChild(founder(), 'f', 'male', 'ابن')
    const withWife = addWife(r.root, r.id, 'ز').root
    expect(() => updatePerson(withWife, r.id, { gender: 'female' })).toThrow()
    expect(findNode(updatePerson(r.root, r.id, { gender: 'female' }), r.id)!.gender).toBe('female')
  })

  it('delete removes the whole branch and leaves the rest alone', () => {
    const t = generateTree({ size: 300, shape: 'wide', seed: 3 })
    const victim = t.children[0].children[0]
    const next = deletePerson(t, victim.id)
    expect(countSubtree(next)).toBe(countSubtree(t) - countSubtree(victim))
    expect(next.children[1]).toBe(t.children[1]) // untouched branches are shared
    expect(() => deletePerson(t, t.id)).toThrow()
    clean(next)
  })

  it('fold, count hidden, and reveal a hidden person', () => {
    const t = generateTree({ size: 300, shape: 'deep', seed: 5 })
    const son = t.children[0].children[0]
    let r = setCollapsed(t, son.id, true)
    expect(findNode(r, son.id)!.collapsed).toBe(true)
    expect(hiddenCount(findNode(r, son.id)!)).toBe(countSubtree(son) - 1)
    const deep = son.children[0].children[0]
    r = reveal(r, deep.id)
    expect(findNode(r, son.id)!.collapsed).toBeUndefined()
    clean(r)
  })
})

describe('undo / redo', () => {
  it('walks back and forth, and a new edit drops the redo list', () => {
    let h = startHistory(founder())
    h = commit(h, updatePerson(h.present, 'f', { name: 'أ' }))
    h = commit(h, updatePerson(h.present, 'f', { name: 'ب' }))
    h = undo(h)
    expect(h.present.name).toBe('أ')
    h = undo(h)
    expect(h.present.name).toBe('جد')
    h = undo(h) // nothing left: no change
    expect(h.present.name).toBe('جد')
    h = redo(h)
    expect(h.present.name).toBe('أ')
    h = commit(h, updatePerson(h.present, 'f', { name: 'ج' }))
    expect(h.future).toEqual([])
  })
})

describe('Arabic search', () => {
  it('ignores diacritics and treats letter variants as equal', () => {
    expect(normalize('أَحْمَد')).toBe(normalize('احمد'))
    expect(normalize('إبراهيم')).toBe(normalize('ابراهيم'))
    expect(normalize('آمنة')).toBe(normalize('امنه'))
    expect(normalize('مصطفى')).toBe(normalize('مصطفي'))
    expect(normalize('عـــلي')).toBe(normalize('علي'))
  })

  it('finds people inside folded branches', () => {
    let r = addChild(founder(), 'f', 'male', 'إبراهيم')
    const hidden = r.id
    r = { ...r, root: setCollapsed(r.root, 'f', true) }
    const hits = search(r.root, 'ابراهيم')
    expect(hits.map((h) => h.node.id)).toEqual([hidden])
    expect(hits[0].path[0].id).toBe('f')
  })
})
