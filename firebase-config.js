/* ===== Firebase config (the ONE place to plug in accounts) =====
 * Accounts + cross-device sync stay OFF ("coming soon") while this is null.
 * Paste the web app config from Firebase console → Project settings → Your apps → Web app → SDK setup (Config):
 *   window.FIREBASE_CONFIG = { apiKey: "...", authDomain: "PROJECT.firebaseapp.com", projectId: "PROJECT", appId: "..." };
 * (These values are public identifiers, not secrets. Security comes from firestore.rules.)
 * The Android build can also fill this in automatically from firebase/google-services.json.
 */
window.FIREBASE_CONFIG = window.FIREBASE_CONFIG || null;
