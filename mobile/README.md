# Triangle LLM mobile (Expo)

A small Expo app written from scratch for TriangleOS (no AnythingLLM Mobile code). Screens: Google sign-in through the shared
Supabase project, the region the server assigned to the account, and chat through `llm.triangleos.com`.

- Sign-in session is stored in the iOS Keychain / Android Keystore (`src/storage/secureStore.ts`), split into chunks because sessions can exceed the 2 KB SecureStore guideline.
- Sign out revokes the refresh token on Supabase and clears the device copy.
- Offline, cancel (abort), region-not-assigned (403) and service-unavailable states are shown, never a made-up reply.
- The app only sends the user's own access token. No service or model secrets are in the bundle.

## Run it (free)

1. `cd sdk && npm install && npm run build`, then `cd ../mobile && npm install`.
2. Copy `.env.example` to `.env` and add the Supabase publishable key.
3. In Supabase, Auth, URL Configuration, add the redirect URL `trianglellm://auth-callback` (and the `exp://...` URL Expo prints, for Expo Go).
4. `npx expo start`, then open it with Expo Go on your phone.

Checked here with `npx tsc --noEmit` and `npx expo export --platform android` (the bundle builds). It has not been run on a device yet.

## Store release

- Sign in with Apple is shown on iOS (Apple requires it next to Google sign-in). Enable the Apple provider in Supabase once the Apple Developer account exists.
- In-app account deletion calls `POST /v1/account/delete` (needs the Pages secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`). Accounts are shared by all TriangleOS apps and the app says so before deleting.
- `eas.json`: `preview` builds an installable Android APK; `production` builds store bundles and submits Android to the internal testing track as a draft.
- Listing text, data declarations and review notes: `store/listing.md`. Icons in `assets/` are simple placeholders; replace them with the TriangleOS logo.

Publishing costs money (Apple USD 99 a year, Google Play USD 25 once), so nothing is enrolled or submitted.
