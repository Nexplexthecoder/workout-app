// Firebase backend adapter for Workout accounts + sync.
// Interface (same as the test mock): available, init(), onAuth(cb), signUp, signIn, google, signOut, reset, pull(uid), push(uid, state, updatedAt)
// Data: Firestore doc users/{uid} = { state: <JSON string>, updatedAt: <ms>, schema: 2, device }
// 1.2.0: .support = tickets/roles API (full Firestore SDK, realtime listeners). Layout + rules: firestore.rules
import {
  initializeApp, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver,
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, GoogleAuthProvider, signInWithCredential, signInWithPopup, signInWithRedirect,
  getRedirectResult, connectAuthEmulator, getFirestore, doc, getDoc, setDoc, connectFirestoreEmulator,
  sendEmailVerification, reload, FS
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
  // Full Firestore (realtime) for support tickets; same app + auth.
  const fdb = FS.getFirestore(app);
  if (opts.emulator) FS.connectFirestoreEmulator(fdb, opts.emulator.host, opts.emulator.port);
  const toUser = (u) => u && { uid: u.uid, email: u.email || '', name: u.displayName || '', emailVerified: !!u.emailVerified, provider: (u.providerData[0] && u.providerData[0].providerId) || 'password' };
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
    sendVerification: () => wrap(sendEmailVerification(auth.currentUser)),
    // Re-read the account (e.g. after the user clicked the verification link) and refresh the ID token claims.
    async refreshUser() {
      const u = auth.currentUser; if (!u) return null;
      await wrap(reload(u)); await wrap(u.getIdToken(true));
      return toUser(auth.currentUser);
    },
    support: createSupportApi(fdb, auth, friendly),
    push: (uid, state, updatedAt, device) =>
      wrap(setDoc(doc(db, 'users', uid), { state: JSON.stringify(state), updatedAt, schema: 2, device: String(device || '').slice(0, 80) })),
  };
}

// ---------- 1.2.0 customer support ----------
// config/roles {admins, trainers, tech, numbers:{uid:n}}; tickets/{id} (+ messages, shared/snapshot); users_public/{uid}.
function createSupportApi(db, auth, friendly) {
  const { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, writeBatch, increment, runTransaction } = FS;
  const wrap = (p) => p.catch((e) => { throw friendly(e); });
  const rolesRef = doc(db, 'config', 'roles');
  const tsnap = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
  const rnd = (taken) => { for (let i = 0; i < 200; i++) { const n = 1000 + Math.floor(Math.random() * 9000); if (!taken.has(n)) return n; } throw new Error('No free staff numbers'); };
  const clip = (t, n) => String(t || '').slice(0, n);
  return {
    // roles: cb(null) when config/roles doesn't exist yet
    watchRoles: (cb, err) => onSnapshot(rolesRef, (s) => cb(s.exists() ? s.data() : null), (e) => err && err(friendly(e))),
    async claimAdmin() {
      const me = auth.currentUser.uid;
      return wrap(runTransaction(db, async (tx) => {
        const s = await tx.get(rolesRef);
        if (s.exists()) throw Object.assign(new Error('An admin is already set up.'), { code: 'exists' });
        tx.set(rolesRef, { admins: [me], trainers: [], tech: [], numbers: { [me]: rnd(new Set()) }, updatedAt: Date.now() });
      }));
    },
    publishProfile: (u) => wrap(setDoc(doc(db, 'users_public', u.uid), { email: String(u.email || '').toLowerCase(), displayName: clip(u.name, 100), emailVerified: !!u.emailVerified, updatedAt: Date.now() })),
    // admin only
    async findByEmail(email) {
      const s = await wrap(getDocs(query(collection(db, 'users_public'), where('email', '==', String(email).trim().toLowerCase()), limit(1))));
      return s.empty ? null : { uid: s.docs[0].id, ...s.docs[0].data() };
    },
    async profile(uid) { const s = await wrap(getDoc(doc(db, 'users_public', uid))); return s.exists() ? s.data() : null; },
    // add (types: ['trainer','tech'] subset) or remove (types: []) a staff member; keeps their number while they have any role
    async setStaff(uid, types) {
      return wrap(runTransaction(db, async (tx) => {
        const s = await tx.get(rolesRef); if (!s.exists()) throw new Error('Set up admin first.');
        const r = s.data(); const numbers = { ...(r.numbers || {}) };
        const put = (list, on) => { const l = (list || []).filter((x) => x !== uid); if (on) l.push(uid); return l; };
        const trainers = put(r.trainers, types.includes('trainer')), tech = put(r.tech, types.includes('tech'));
        const staff = trainers.includes(uid) || tech.includes(uid) || (r.admins || []).includes(uid);
        if (staff && !numbers[uid]) numbers[uid] = rnd(new Set(Object.values(numbers)));
        if (!staff) delete numbers[uid];
        tx.update(rolesRef, { trainers, tech, numbers, updatedAt: Date.now() });
        return numbers[uid] || null;
      }));
    },
    // tickets
    watchMyTickets: (uid, cb, err) => onSnapshot(query(collection(db, 'tickets'), where('uid', '==', uid)), (s) => cb(tsnap(s)), (e) => err && err(friendly(e))),
    // staff: one listener per type they handle (rules need provably-filtered queries); admins: everything
    watchStaffTickets(scope, cb, err) {
      const e2 = (e) => err && err(friendly(e));
      if (scope.all) return onSnapshot(query(collection(db, 'tickets'), orderBy('updatedAt', 'desc'), limit(300)), (s) => cb(tsnap(s)), e2);
      const parts = {}; const subs = scope.types.map((t) => onSnapshot(query(collection(db, 'tickets'), where('type', '==', t)), (s) => { parts[t] = tsnap(s); cb(Object.values(parts).flat()); }, e2));
      return () => subs.forEach((u) => u());
    },
    watchTicket: (id, cb, err) => onSnapshot(doc(db, 'tickets', id), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null), (e) => err && err(friendly(e))),
    watchMessages: (id, cb, err) => onSnapshot(query(collection(db, 'tickets', id, 'messages'), orderBy('at')), { includeMetadataChanges: true }, (s) => cb(s.docs.map((d) => ({ id: d.id, pending: d.metadata.hasPendingWrites, ...d.data() }))), (e) => err && err(friendly(e))),
    async createTicket({ type, subject, text, appVersion, device, snapshot }) {
      const u = auth.currentUser; const now = Date.now();
      const tref = doc(collection(db, 'tickets')); const b = writeBatch(db);
      b.set(tref, { uid: u.uid, userEmail: String(u.email || '').toLowerCase(), type, subject: clip(subject, 120), status: 'open', createdAt: now, updatedAt: now,
        lastFrom: 'user', lastText: clip(text, 200), unreadForUser: 0, unreadForSupport: 1, appVersion: clip(appVersion, 20), device: clip(device, 200), shareData: !!snapshot });
      b.set(doc(collection(db, 'tickets', tref.id, 'messages')), { from: 'user', text: clip(text, 4000), at: now });
      if (snapshot) b.set(doc(db, 'tickets', tref.id, 'shared', 'snapshot'), { state: snapshot, at: now });
      await wrap(b.commit()); return tref.id;
    },
    // as: 'user' or {role: ticket.type, number}
    async send(ticket, text, as) {
      const now = Date.now(); const b = writeBatch(db); const tref = doc(db, 'tickets', ticket.id);
      if (as === 'user') {
        b.set(doc(collection(tref, 'messages')), { from: 'user', text: clip(text, 4000), at: now });
        b.update(tref, { lastFrom: 'user', lastText: clip(text, 200), updatedAt: now, unreadForSupport: increment(1), status: 'open' });
      } else {
        b.set(doc(collection(tref, 'messages')), { from: 'support', role: ticket.type, senderNumber: as.number, text: clip(text, 4000), at: now });
        b.update(tref, { lastFrom: 'support', lastText: clip(text, 200), updatedAt: now, unreadForUser: increment(1), unreadForSupport: 0 });
      }
      return wrap(b.commit());
    },
    setStatus: (id, status) => wrap(updateDoc(doc(db, 'tickets', id), { status, updatedAt: Date.now() })),
    markRead: (id, who) => wrap(updateDoc(doc(db, 'tickets', id), who === 'user' ? { unreadForUser: 0 } : { unreadForSupport: 0 })),
    async share(id, snapshot) {
      const b = writeBatch(db); const sref = doc(db, 'tickets', id, 'shared', 'snapshot');
      if (snapshot) b.set(sref, { state: snapshot, at: Date.now() }); else b.delete(sref);
      b.update(doc(db, 'tickets', id), { shareData: !!snapshot });
      return wrap(b.commit());
    },
    async readShared(id) { const s = await wrap(getDoc(doc(db, 'tickets', id, 'shared', 'snapshot'))); return s.exists() ? s.data() : null; },
  };
}
