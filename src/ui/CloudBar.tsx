import { useEffect, useRef, useState } from 'react'
import type { TreeNode } from '../model/types'
import { STORAGE_KEY } from '../model/types'
import { countNodes } from '../model/validate'

// The editor's phone: once linked, every change goes online by itself, and
// relatives see it at the view link. Linking is per phone and asks first, so
// a new phone can never quietly replace the online tree.
const LINK_KEY = `${STORAGE_KEY}_cloud`
const cloud = () => import('../cloud/cloud')

type Status = 'off' | 'checking' | 'saving' | 'ok' | 'error' | 'signed-out'

export const viewLink = (uid: string) => `${location.origin}${location.pathname}?view=${uid}`

function readLink(): string | null {
  try { return localStorage.getItem(LINK_KEY) } catch { return null }
}

export function CloudBar({ root, btn, say }: { root: TreeNode; btn: string; say(m: string): void }) {
  const [uid, setUid] = useState(readLink)
  const [status, setStatus] = useState<Status>(uid ? 'checking' : 'off')
  const latest = useRef(root)
  latest.current = root
  const busy = useRef(false)
  const again = useRef(false)

  async function publish(id: string) {
    if (busy.current) return void (again.current = true)
    busy.current = true
    setStatus('saving')
    try {
      do {
        again.current = false
        await (await cloud()).publishTree(id, latest.current)
      } while (again.current)
      setStatus('ok')
    } catch (e) {
      setStatus('error')
      say(failText(e))
    } finally {
      busy.current = false
    }
  }

  // on opening: make sure this phone is still signed in as the linked editor
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!uid) return
    void cloud().then((c) => c.signedInUser()).then((u) => {
      if (u?.uid === uid) setReady(true)
      else setStatus('signed-out')
    }, () => setStatus('error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // on opening and after every change: publish a moment later, so a burst of edits is one upload
  useEffect(() => {
    if (!uid || !ready) return
    const t = setTimeout(() => void publish(uid), 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, ready])

  async function link() {
    try {
      const c = await cloud()
      const u = await c.signIn()
      const online = await c.fetchTree(u.uid)
      if (online?.ok && u.uid !== uid &&
        !confirm(`توجد شجرة منشورة (${countNodes(online.root)} شخص). استبدالها بشجرة هذا الهاتف (${countNodes(root)} شخص)؟`)) return
      try { localStorage.setItem(LINK_KEY, u.uid) } catch { /* still works until the page closes */ }
      setUid(u.uid)
      await publish(u.uid)
      setReady(true)
      say('تم النشر. أرسل «رابط الأقارب» لمن تريد، وكل تعديل بعد الآن يصلهم وحده.')
    } catch (e) {
      say(failText(e))
    }
  }

  async function shareLink() {
    const url = viewLink(uid!)
    try {
      if (navigator.share) await navigator.share({ url, title: 'شجرة العائلة' })
      else { await navigator.clipboard.writeText(url); say(`تم نسخ الرابط: ${url}`) }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') say(url)
    }
  }

  if (!uid || status === 'signed-out') {
    return <button className={btn} onClick={() => void link()}>{uid ? '☁ سجل الدخول للنشر' : '☁ نشر للأقارب'}</button>
  }
  const label = { checking: '☁ …', saving: '☁ جاري النشر…', ok: '☁ منشور', error: '☁ لم يُنشر، أعد المحاولة', off: '', 'signed-out': '' }[status]
  return <>
    <button className={`${btn} ${status === 'error' ? 'bg-red-500/60' : ''}`} disabled={status === 'saving' || status === 'checking'}
      onClick={() => void publish(uid)}>{label}</button>
    <button className={btn} onClick={() => void shareLink()}>رابط الأقارب</button>
  </>
}

function failText(e: unknown): string {
  const code = (e as { code?: string }).code ?? ''
  if (code === 'permission-denied') return 'هذا الحساب غير مسموح له بالنشر. النشر لحساب واحد فقط.'
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'تم إلغاء تسجيل الدخول.'
  if (code === 'auth/popup-blocked') return 'المتصفح منع نافذة تسجيل الدخول. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.'
  return `لم يتم النشر، تحقق من الإنترنت ثم اضغط «لم يُنشر» للمحاولة مجدداً. (${code || String(e)})`
}
