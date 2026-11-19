# Workout

Minimal mobile workout planner: routines with your own typed exercises, rest days and cheat days, scheduling, how-to videos, guided workouts.

- Web app: https://nexplexthecoder.github.io/workout-app/
- Android app: download the latest `Workout-X.Y.Z.apk` from [Releases](https://github.com/Nexplexthecoder/workout-app/releases). The installed app checks Releases on launch and offers new versions automatically.

## Accounts and sync (Firebase)
- **Guest**: everything stays on the device. Nothing syncs.
- **Account** (email/password, and Google on the Android app): routines, schedule, history and video links sync through Firestore doc `users/{uid}`. Uploaded video files stay on the phone they were added on.
- Web config lives in `firebase-config.js` (public client identifiers, not secrets). Security rules: `firestore.rules`.
- Native Google sign-in on Android needs a valid `firebase/google-services.json` in the Android project; see `/workspace/workout-app-android/firebase/README.md`. Without that file the Google button shows "coming soon". With it (as of 1.1.2) the button is enabled and uses the native account picker.

## Files
- `index.html`: the app
- `firebase-config.js`: Firebase web config (null = accounts off)
- `backend-firebase.js`: auth + sync adapter; `vendor/firebase.js` is the bundled Firebase JS SDK (built from `src/firebase-entry.js`)
- `sw.js`: offline cache. Bump `VERSION` when files change.

## Releasing an Android update
Build with the Android wrapper (`./build-apk.sh X.Y.Z`, same signing key every time), then publish a GitHub release `vX.Y.Z` with the asset `Workout-X.Y.Z.apk`.

## Feedback
The in-app Feedback button opens a prefilled issue on this repo.
