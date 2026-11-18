// Bundled into vendor/firebase.js with esbuild (see workout-app-android/scripts/build-firebase.sh).
export { initializeApp } from 'firebase/app';
export {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver,
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, GoogleAuthProvider, signInWithCredential, signInWithPopup, signInWithRedirect,
  getRedirectResult, connectAuthEmulator
} from 'firebase/auth';
export { getFirestore, doc, getDoc, setDoc, connectFirestoreEmulator } from 'firebase/firestore/lite';
