// Bundled into vendor/firebase.js with esbuild (see workout-app-android/scripts/build-firebase.sh).
export { initializeApp } from 'firebase/app';
export {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver,
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, GoogleAuthProvider, signInWithCredential, signInWithPopup, signInWithRedirect,
  getRedirectResult, connectAuthEmulator, sendEmailVerification, reload
} from 'firebase/auth';
// Workout data sync (users/{uid}) keeps using firestore-lite (plain request/response, fails fast offline).
export { getFirestore, doc, getDoc, setDoc, connectFirestoreEmulator } from 'firebase/firestore/lite';
// 1.2.0 support tickets use the full SDK for realtime listeners.
export * as FS from 'firebase/firestore';
