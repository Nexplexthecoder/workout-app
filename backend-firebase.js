// Firebase backend adapter for Workout accounts + sync.
// Interface (same as the test mock): available, init(), onAuth(cb), signUp, signIn, google, signOut, reset, pull(uid), push(uid, state, updatedAt)
// Data: Firestore doc users/{uid} = { state: <JSON string>, updatedAt: <ms>, schema: 2, device }
import {
  initializeApp, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver,
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, GoogleAuthProvider, signInWithCredential, signInWithPopup, signInWithRedirect,
  getRedirectResult, connectAuthEmulator, getFirestore, doc, getDoc, setDoc, connectFirestoreEmulator
} from './vendor/firebase.js';

const CAP = window.Capacitor;
const NATIVE = !!(CAP && CAP.isNativePlatform && CAP.isNativePlatform());
function nativePlugin(name) {
  try {
    if (!NATIVE || !(CAP.isPluginAvailable && CAP.isPluginAvailable(name))) return null;
    return (CAP.Plugins && CAP.Plugins[name]) || (CAP.registerPlugin && CAP.registerPlugin(name)) || null;
  } catch (e) { return null; }
}

const friendly = (e) => {
  const c = (e && e.code) || '';
  const m = {
    'auth/email-already-in-use': 'That email already has an account. Try signing in.',
    'auth/invalid-email': 'That email address doesn\'t look right.',
    'auth/weak-password': 'Use a password with at least 6 characters.',
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/user-not-found': 'No account with that email.',
    'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
    'auth/network-request-failed': 'No connection. Check your internet and try again.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/operation-not-allowed': 'This sign-in method isn\'t turned on yet.',
    'permission-denied': 'The server refused access to your data.',
    'unavailable': 'Can\'t reach the server right now.',
  }[c];
  const err = new Error(m || (e && e.message) || 'Something went wrong');
  err.code = c;
  return err;
};

export function createFirebaseBackend(config, opts = {}) {
  const app = initializeApp(config);
  const auth = initializeAuth(app, NATIVE
    ? { persistence: [indexedDBLocalPersistence, browserLocalPersistence] }
    : { persistence: [indexedDBLocalPersistence, browserLocalPersistence], popupRedirectResolver: browserPopupRedirectResolver });
  const db = getFirestore(app);
  if (opts.emulator) {
    connectAuthEmulator(auth, opts.emulator.auth, { disableWarnings: true });
    connectFirestoreEmulator(db, opts.emulator.host, opts.emulator.port);
  }
  const toUser = (u) => u && { uid: u.uid, email: u.email || '', name: u.displayName || '', provider: (u.providerData[0] && u.providerData[0].providerId) || 'password' };
  const wrap = (p) => p.catch((e) => { throw friendly(e); });
  const ready = (typeof auth.authStateReady === 'function' ? auth.authStateReady() : Promise.resolve())
    .then(() => (NATIVE ? null : getRedirectResult(auth).catch(() => null)));

  return {
    kind: 'firebase',
    available: true,
    nativeGoogle: !!nativePlugin('FirebaseAuthentication'),
    init: () => ready.then(() => toUser(auth.currentUser)),
    onAuth: (cb) => onAuthStateChanged(auth, (u) => cb(toUser(u))),
    signUp: (email, pw) => wrap(createUserWithEmailAndPassword(auth, email, pw).then((r) => toUser(r.user))),
    signIn: (email, pw) => wrap(signInWithEmailAndPassword(auth, email, pw).then((r) => toUser(r.user))),
    reset: (email) => wrap(sendPasswordResetEmail(auth, email)),
    async google() {
      const FA = nativePlugin('FirebaseAuthentication');
      if (FA) {
        // Native Google account picker; the ID token is then handed to the Firebase JS SDK (skipNativeAuth: true).
        const r = await FA.signInWithGoogle().catch((e) => { throw friendly({ code: /cancel/i.test(e && e.message) ? 'auth/popup-closed-by-user' : '', message: e && e.message }); });
        const tok = r && r.credential && r.credential.idToken;
        if (!tok) throw new Error('Google sign-in did not return a token');
        return wrap(signInWithCredential(auth, GoogleAuthProvider.credential(tok)).then((x) => toUser(x.user)));
      }
      if (NATIVE) throw new Error('Google sign-in isn\'t set up in this app build yet. Use email instead.');
      const p = new GoogleAuthProvider();
      try { return toUser((await signInWithPopup(auth, p)).user); }
      catch (e) {
        if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) { await signInWithRedirect(auth, p); return null; }
        throw friendly(e);
      }
    },
    async signOut() {
      const FA = nativePlugin('FirebaseAuthentication');
      if (FA) { try { await FA.signOut(); } catch (e) {} }
      return wrap(signOut(auth));
    },
    async pull(uid) {
      const s = await wrap(getDoc(doc(db, 'users', uid)));
      if (!s.exists()) return null;
      const d = s.data();
      return { state: typeof d.state === 'string' ? JSON.parse(d.state) : d.state, updatedAt: d.updatedAt || 0 };
    },
    push: (uid, state, updatedAt, device) =>
      wrap(setDoc(doc(db, 'users', uid), { state: JSON.stringify(state), updatedAt, schema: 2, device: String(device || '').slice(0, 80) })),
  };
}
