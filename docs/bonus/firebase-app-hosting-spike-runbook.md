# Bonus Firebase／App Hosting Spike Runbook

> This runbook belongs to the Firebase real-time game bonus. It is not part of
> the CAT WALK main product deployment.

## Objective

Prove the smallest useful path before building `/party-game`:

1. The Angular client builds from `client/`.
2. Firebase Hosting remains available as a fallback.
3. An independent Firebase App Hosting backend can deploy the Angular client.
4. The project can provide Anonymous Auth, Firestore, Firebase AI Logic, and App Check.
5. The first rollout uses no custom API server, Cloud Functions, Cloud Run API, or WebSocket server.

## Current repository facts

- The client Firebase config currently points to `cathay-ai-hackathon-team-03`.
- The repository's Git remote is Azure DevOps, not GitHub.
- The Firebase CLI is not installed globally in the current workstation environment.
- The client is Angular 22. Firebase App Hosting has an Angular adapter, but the current official support table lists Angular 18.2 and 19.x. Angular 22 is therefore a spike risk and must be validated by an actual rollout before it is treated as supported.
- The installed `@angular/fire@21.0.0-rc.0` AI wrapper is not currently usable with the installed Firebase JS SDK 12.18.0: its `provideAI` bundle imports `getImagenModel`, which the installed SDK does not export. The first AI Logic slice should therefore use the Firebase JS `firebase/ai` API directly, behind a bonus-specific service, until the dependency pair is upgraded and verified together.
- `client/apphosting.yaml` intentionally contains only small Cloud Run resource limits. It does not define a custom build or run command, so App Hosting can use its Angular adapter first.
- On 2026-09-15, `npm run build` passed after increasing the existing Angular initial-bundle error budget from 1.30 MB to 1.50 MB. The current initial bundle is about 1.35 MB; Angular still reports two pre-existing unused Ionic import warnings in `HomeComponent`.

## Step 0 — permissions and cost guardrails

An Ops or Firebase project administrator must complete these items in the Firebase / Google Cloud Console:

- Confirm the target project is `cathay-ai-hackathon-team-03`; stop if the project ID is different.
- Confirm the project is on the Blaze plan. App Hosting requires Blaze.
- Confirm the team knows who owns billing and who will remove test data after the demo.
- Create budget alerts at 50%, 80%, and 100% of the approved demo budget.
- Set low daily Gemini and Firestore quotas for the spike, then raise them only when the multiplayer test needs it.
- Record the billing owner and cleanup owner in the team handoff, not in source control.

## Step 1 — enable Firebase services

In Firebase Console:

1. Authentication → Sign-in method → enable Anonymous.
2. Firestore Database → create or confirm a Native mode database. Use the team-approved region; do not create a second database casually.
3. AI Services → AI Logic → Get started. For the first spike use the Gemini Developer API unless the project owner has explicitly chosen Agent Platform / Vertex AI.
4. App Check → register the existing web app with reCAPTCHA v3 or the provider approved by Ops.
5. Keep App Check in metrics / unenforced mode until a local debug token and the App Hosting domain have both been registered. Enforce only after the smoke test succeeds.

The reCAPTCHA site key is public configuration. After registration, put it in
`client/src/app/firebase-config.ts` as `firebaseAppCheckSiteKey`. Never put a
reCAPTCHA secret, App Check debug token, Gemini key, or service-account key in
the repository.

## Step 2 — local checks

From the repository root:

```powershell
Set-Location client
npm ci
npm run build
Set-Location ..
```

After Firebase CLI access is available, verify the fallback locally:

```powershell
npx firebase-tools@latest hosting:channel:deploy spike --project cathay-ai-hackathon-team-03
```

The generated output must be `client/dist/client/browser`. The fallback must
serve `index.html` for Angular client-side routes such as `/party-game`.

When App Check is configured locally, start the app on localhost and register
the one-time debug token printed by Firebase in DevTools. Do not copy that
token into this file.

## Step 3 — App Hosting backend

In Firebase Console → Hosting & Serverless → App Hosting:

1. Create a new backend dedicated to the bonus game; do not replace the CAT WALK Hosting site.
2. Set the root directory to `client/`.
3. Select the team-approved primary region.
4. Connect the supported GitHub / Developer Connect repository and select the agreed branch.
5. Enable automatic rollouts.
6. Use a Node.js runtime supported by App Hosting, normally Node 22 for this spike.
7. Keep the first rollout at the resource limits in `client/apphosting.yaml`.
8. Trigger one rollout with the current Angular 22 client.

If the supported repository connection is not available yet, perform the
manual App Hosting deployment path allowed by the console / Firebase CLI and
record it as a temporary spike result. Do not block the rest of the Firebase
smoke test on GitHub integration, but do not claim automatic rollout is proven.

## Step 4 — smoke-test acceptance

Record the result and timestamp below after the rollout:

| Check | Result | Evidence / URL |
| --- | --- | --- |
| `npm run build` | ☑ pass ☐ fail | `client/dist/client` on 2026-09-15 |
| Firebase Hosting fallback | ☐ pass ☐ fail | |
| App Hosting rollout | ☐ pass ☐ fail | |
| Angular 22 compatibility | ☐ pass ☐ fail ☐ unsupported | |
| Anonymous Auth sign-in | ☐ pass ☐ fail | |
| Firestore read / realtime listener | ☐ pass ☐ fail | |
| Firebase AI Logic model call | ☐ pass ☐ fail | |
| App Check token accepted | ☐ pass ☐ fail | |
| Automatic rollout from connected branch | ☐ pass ☐ fail ☐ not tested | |

The spike is **go** only if the App Hosting rollout works, the fallback still
works, and the Firebase service smoke tests pass. A failed Angular 22 rollout
is a technical decision point; do not silently downgrade Angular. Record the
error, then decide whether to pin a supported Angular version or use Firebase
Hosting for the bonus demo.

## Cleanup

Until the game has a formal cleanup script, delete test rooms and anonymous
users created for the spike from the approved Demo project. Do not delete the
CAT WALK main product data or Firebase Hosting site.

## Official references

- [Firebase App Hosting frameworks and tooling](https://firebase.google.com/docs/app-hosting/frameworks-tooling)
- [Firebase App Hosting getting started](https://firebase.google.com/docs/app-hosting/get-started)
- [Firebase App Hosting configuration](https://firebase.google.com/docs/app-hosting/configure)
- [Firebase AI Logic web getting started](https://firebase.google.com/docs/ai-logic/get-started?platform=web)
- [Firebase Anonymous Auth for JavaScript](https://firebase.google.com/docs/auth/web/anonymous-auth)
- [Firebase App Check for web](https://firebase.google.com/docs/app-check/web/recaptcha-provider)
- [Firebase App Check debug provider](https://firebase.google.com/docs/app-check/web/debug-provider)
