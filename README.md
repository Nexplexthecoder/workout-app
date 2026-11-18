# Workout Planner

Minimal mobile workout planner (PWA). Everything is stored on the phone: no accounts, no server.

Live app (after enabling Pages): https://nexplexthecoder.github.io/workout-app/

## Publish with GitHub Pages
1. Push these files to the root of the `main` branch of `Nexplexthecoder/workout-app`.
2. In the repo, open Settings → Pages → Build and deployment → Source: "Deploy from a branch", Branch: `main`, folder `/ (root)` → Save.
3. Wait 1–2 minutes, then open the link above on your phone in Chrome and use ⋮ → "Add to Home screen" / "Install app".

## Feedback
The in-app Feedback button opens a prefilled issue on this repo (`FEEDBACK_REPO` at the top of `index.html`).
Optional: create the labels `bug`, `enhancement` and `question` (GitHub creates these by default in new repos).

## Updating
After changing files, bump `VERSION` in `sw.js` so installed phones pick up the new version.
