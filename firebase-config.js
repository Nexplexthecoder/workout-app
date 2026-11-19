/* ===== Firebase config (the ONE place to plug in accounts) =====
 * Public client identifiers from Firebase console → Project settings → Your apps → Web app.
 * These are not secrets. Security comes from firestore.rules.
 * Tests may set window.FIREBASE_CONFIG before this file runs (including null, to test "coming soon").
 */
if (!Object.prototype.hasOwnProperty.call(window, 'FIREBASE_CONFIG')) {
  window.FIREBASE_CONFIG = {
    apiKey: "AIzaSyCaJzBwkJRxWU0pw-eaAcT5HvwxbUEbwNw",
    authDomain: "workoutapprockz.firebaseapp.com",
    projectId: "workoutapprockz",
    storageBucket: "workoutapprockz.firebasestorage.app",
    messagingSenderId: "920075260133",
    appId: "1:920075260133:web:a330e75bf55c9d64b3440c"
  };
}
