# Triangle LLM mobile (Expo)

A small Expo app written from scratch for TriangleOS (no AnythingLLM Mobile code). Two tabs:

- **On this phone** (opens first, no account): download a GGUF model once, then chat with it offline. It runs through
  [llama.rn](https://github.com/mybigday/llama.rn) (llama.cpp, MIT) on the phone's CPU, or Metal on iPhone. Messages never
  leave the phone. Code: `src/ondevice/` and `src/screens/DeviceScreen.tsx`.
- **Triangle server**: Google sign-in through the shared Supabase project, the region the server assigned to the account,
  and chat through `llm.triangleos.com`.

## On-device models

Until Triangle LLM v1 passes its hold-out test and its GGUF is published, the list holds the same stand-ins as
llm.triangleos.com/device: Qwen3 0.6B (397 MB) and Qwen3 1.7B (1.1 GB), 4-bit Q4_K_M files from `unsloth/Qwen3-*-GGUF`.
They are labelled as Alibaba's models and their system prompt says they are not Triangle LLM.

To add Triangle LLM, set three repository variables (Settings, Secrets and variables, Actions, Variables) and rebuild:
`TRIANGLE_GGUF_REPO` (for example `TriangleOS/triangle-llm-v1-gguf`; the repo must be public so phones can download it),
`TRIANGLE_GGUF_FILE` (for example `triangle-llm-v1-Q4_K_M.gguf`) and optionally `TRIANGLE_GGUF_MB`. It then appears first
in the list. Locally the same values are `EXPO_PUBLIC_TRIANGLE_GGUF_REPO`, `_FILE` and `_MB` in `.env`.

Downloads go to the app's private storage, check free space first, and are checked against the exact file size before
use. Generation uses Qwen3's no-thinking mode, up to 512 tokens, 4096-token context.

## Free Android test build

`.github/workflows/mobile-apk.yml` builds an installable APK (arm64 phones) on GitHub's free runners for every pull
request that touches the app (download it from the run's Artifacts) and, after a merge to main, publishes it as the
`mobile-latest` pre-release on GitHub. Install it on an Android phone by opening the APK and allowing installs from the
browser. It is signed with the shared React Native test key, so it is for testing only; store builds use EAS's own key.

Expo Go can't run the on-device tab (llama.rn is native code); use the test APK or `npx expo run:android`.
iPhones need an Apple developer account (USD 99 a year) to install anything outside Expo Go, so there is no iOS test build.

- Sign-in session is stored in the iOS Keychain / Android Keystore (`src/storage/secureStore.ts`), split into chunks because sessions can exceed the 2 KB SecureStore guideline.
- Sign out revokes the refresh token on Supabase and clears the device copy.
- Offline, cancel (abort), region-not-assigned (403) and service-unavailable states are shown, never a made-up reply.
- The app only sends the user's own access token. No service or model secrets are in the bundle.

## Run it (free)

1. `cd sdk && npm install && npm run build`, then `cd ../mobile && npm install`.
2. Copy `.env.example` to `.env` and add the Supabase publishable key.
3. In Supabase, Auth, URL Configuration, add the redirect URL `trianglellm://auth-callback` (and the `exp://...` URL Expo prints, for Expo Go).
4. `npx expo start`, then open it with Expo Go on your phone (server tab only), or `npx expo run:android` for both tabs.

Checked here with `npx tsc --noEmit` and `npx expo export --platform android` (the bundle builds). It has not been run on a device yet.

## Store release

- Sign in with Apple is shown on iOS (Apple requires it next to Google sign-in). Enable the Apple provider in Supabase once the Apple Developer account exists.
- In-app account deletion calls `POST /v1/account/delete` (needs the Pages secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`). Accounts are shared by all TriangleOS apps and the app says so before deleting.
- `eas.json`: `preview` builds an installable Android APK; `production` builds store bundles and submits Android to the internal testing track as a draft.
- Listing text, data declarations and review notes: `store/listing.md`. Icons in `assets/` are simple placeholders; replace them with the TriangleOS logo.

Publishing costs money (Apple USD 99 a year, Google Play USD 25 once), so nothing is enrolled or submitted.
