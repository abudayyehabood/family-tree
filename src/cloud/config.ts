// The Firebase project that holds the shared tree. These values are not
// secrets: Firebase web config is public by design. Who may write is decided
// by the rules in firestore.rules, on Firebase's side.
export const FIREBASE_CONFIG: { apiKey: string; authDomain: string; projectId: string; appId: string } | null = {
  apiKey: 'AIzaSyDBcVMWhR1XpPn_qcC0Nam5BZb6SYhfR4o',
  authDomain: 'familytree-abudayyeh.firebaseapp.com',
  projectId: 'familytree-abudayyeh',
  appId: '1:694448533440:web:874b2ef58c58f5dff52225',
}

// `npm run dev:cloud` talks to the local Firebase emulators instead (fake data only).
export const USE_EMULATOR = import.meta.env.VITE_CLOUD_EMULATOR === '1'

export const CLOUD_ON = USE_EMULATOR || FIREBASE_CONFIG !== null
