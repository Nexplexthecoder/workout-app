# Workout

Minimal mobile workout planner: routines with your own typed exercises, rest days and cheat days, scheduling, how-to videos, guided workouts.

- Web app: https://nexplexthecoder.github.io/workout-app/
- Android app: download the latest `Workout-X.Y.Z.apk` from [Releases](https://github.com/Nexplexthecoder/workout-app/releases). The installed app checks Releases on launch and offers new versions automatically.

## Accounts and sync (Firebase)
- **Guest**: everything stays on the device. Nothing syncs.
- **Account** (email/password, and Google on the Android app): routines, schedule, history and video links sync through Firestore doc `users/{uid}`. Uploaded video files stay on the phone they were added on.
- Web config lives in `firebase-config.js` (public client identifiers, not secrets). Security rules: `firestore.rules`.
- Native Google sign-in on Android needs a valid `firebase/google-services.json` in the Android project; see `/workspace/workout-app-android/firebase/README.md`. Without that file the Google button shows "coming soon". With it (as of 1.1.2) the button is enabled and uses the native account picker.

## Help & support (1.2.0)
Signed-in users open tickets (type **Trainer** or **Technical support**) from ⋯ → Help & support and chat in realtime.
Staff: **admins** see every ticket and manage the team; **trainers** see only trainer tickets; **tech** sees only technical tickets.
Staff show to users only as `Trainer #NNNN` / `Support #NNNN` (random 4-digit number assigned when added). Staff see the user's email on the ticket.
Staff can never read `users/{uid}` workout data. A user can attach a read-only snapshot per ticket ("Share my workout data with support").

Firestore layout (rules in `firestore.rules`):
- `config/roles` `{admins:[uid], trainers:[uid], tech:[uid], numbers:{uid:n}, updatedAt}`: readable by signed-in users (UIDs and numbers only), writable by admins only.
- `users_public/{uid}` `{email, displayName, emailVerified, updatedAt}`: each user writes their own; only the owner and admins can read it (used for add-by-email).
- `tickets/{id}` `{uid, userEmail, type, subject, status, createdAt, updatedAt, lastFrom, lastText, unreadForUser, unreadForSupport, appVersion, device, shareData}`
- `tickets/{id}/messages/{mid}`: user `{from:'user', text, at}`, staff `{from:'support', role, senderNumber, text, at}` (no email/name/uid)
- `tickets/{id}/shared/snapshot` `{state, at}`: written by the ticket owner, read-only for staff
No composite indexes are needed: staff queries are `where(type==…)` or `orderBy(updatedAt)`, and user queries are `where(uid==…)`, sorted on the device.

**First admin (one time):** paste `firestore.rules` into Firebase → Firestore → Rules → Publish. Then sign in to the app with
`wyatt.va.gm@gmail.com` (Google sign-in is already verified; for an email/password account, tap *Send verification email*, open the link, then *I've verified it*)
and open ⋯ → Help & support → **Set up admin → Become admin**. The rules only allow this while `config/roles` doesn't exist,
and only for that verified email (`adminEmail()` in the rules). To change the admin email later, edit `adminEmail()` in the rules and `ADMIN_EMAIL` in index.html.
Fallback (console): Firestore → Start collection `config` → document ID `roles` → fields `admins` (array: your UID from Authentication → Users),
`trainers` (empty array), `tech` (empty array), `numbers` (map: your UID → number 1001), `updatedAt` (number 0).

**Adding staff:** the person signs in to the app once. Then the admin goes to Help & support → Manage support team, types their email, ticks Trainer and/or Tech support, and taps **Add**. To remove someone, type the email and tap **Remove**, or tap ✕ on their row.

## Files
- `index.html`: the app
- `firebase-config.js`: Firebase web config (null = accounts off)
- `backend-firebase.js`: auth + sync adapter + support API; `vendor/firebase.js` is the bundled Firebase JS SDK (built from `src/firebase-entry.js`: auth, firestore-lite for sync, full firestore for realtime support)
- `sw.js`: offline cache. Bump `VERSION` when files change.

## Releasing an Android update
Build with the Android wrapper (`./build-apk.sh X.Y.Z`, same signing key every time), then publish a GitHub release `vX.Y.Z` with the asset `Workout-X.Y.Z.apk`.

## Feedback
The in-app Feedback button opens a prefilled issue on this repo.
