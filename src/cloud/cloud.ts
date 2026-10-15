// The online copy of the tree: one document per editor, trees/{uid}.
// Anyone with the link can read it; only the editor (see firestore.rules) can write it.
// This file is loaded only when the cloud is used, so the plain app stays small.
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, type User } from 'firebase/auth'
import { connectFirestoreEmulator, doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore/lite'
import { FIREBASE_CONFIG, USE_EMULATOR } from './config'
import { exportJson, importJson, type ImportResult } from '../model/transfer'
import { countNodes } from '../model/validate'
import type { TreeNode } from '../model/types'

const app = initializeApp(USE_EMULATOR
  ? { apiKey: 'fake', authDomain: 'localhost', projectId: 'demo-family-tree', appId: 'fake' }
  : FIREBASE_CONFIG!)
const auth = getAuth(app)
const db = getFirestore(app)
if (USE_EMULATOR) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

const treeDoc = (uid: string) => doc(db, 'trees', uid)

export async function fetchTree(uid: string): Promise<ImportResult | null> {
  const snap = await getDoc(treeDoc(uid))
  if (!snap.exists()) return null
  return importJson(String(snap.data().json))
}

export async function publishTree(uid: string, root: TreeNode): Promise<void> {
  await setDoc(treeDoc(uid), { json: exportJson(root), count: countNodes(root), updatedAt: serverTimestamp() })
}

// Resolves once Firebase knows whether this phone is still signed in.
export function signedInUser(): Promise<User | null> {
  return new Promise((done) => { const stop = onAuthStateChanged(auth, (u) => { stop(); done(u) }) })
}

export async function signIn(): Promise<User> {
  return (await signInWithPopup(auth, new GoogleAuthProvider())).user
}
