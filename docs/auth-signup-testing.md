# Auth Sign-Up Testing

Use this checklist to verify Apple, Google, and Email sign-up for brand-new
users. A "new user" means Supabase Auth has no existing user or identity for
the provider account or email address being tested.

## Prerequisites

- Supabase env is present in the build:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Supabase Auth providers are enabled for Apple, Google, and Email.
- Supabase Auth redirect allow-list includes the test origin:
  - Local web: `http://localhost:8081`
  - Production web: `https://app.gethelixapp.org`
  - Password reset/native link: `helix://reset-password`
- Native Apple/Google tests use an EAS development or preview build. Expo Go
  is not sufficient for the native provider modules.
- Android Google tests use a device or emulator with Google Play Services, and
  the Android OAuth client has the APK signing SHA-1 registered.
- Web Apple tests only apply when `EXPO_PUBLIC_ENABLE_APPLE_WEB_SIGN_IN=true`
  is baked into the web build and Apple Services ID setup is complete.

## Clean Test Setup

Prefer a fresh Apple ID, Google account, or email inbox for each new-user run.
If reusing an identity:

1. Delete the matching user in Supabase Dashboard -> Authentication -> Users.
2. Reinstall the native app or clear app/browser storage.
3. For Google native, clear cached Google sign-in state if the picker silently
   reuses the previous account.
4. For email tests, use a unique inbox or a supported plus alias such as
   `tester+email-20260606@example.com`.

## Apple New User

Platform: iOS native. Android should not show Apple.

1. Install a fresh EAS iOS dev/preview build.
2. Open `/sign-up`.
3. Tap `Sign in with Apple`.
4. Complete Apple auth with an Apple ID not already present in Supabase.
5. Repeat with Hide My Email if available.

Expected result:

- Supabase creates a new Auth user with an Apple identity.
- Apple Hide My Email may produce a `privaterelay.appleid.com` address.
- Helix routes to `/(auth)/accept-terms`.
- All three terms toggles are required before continuing.
- After acceptance, Helix routes to `/(tabs)`.

## Google New User

Platforms: Android native and web. iOS Google is intentionally hidden in v1.0.

Android:

1. Install a fresh EAS Android dev/preview APK.
2. Open `/sign-up`.
3. Tap `Sign in with Google`.
4. Choose a Google account not already present in Supabase.

Web:

1. Start web with `npm run web`, or open the production web app.
2. Open `/sign-up`.
3. Tap `Sign in with Google`.
4. Complete the OAuth redirect with a Google account not already present in
   Supabase.

Expected result:

- Supabase creates a new Auth user with a Google identity.
- The redirect returns to the app origin on web.
- Helix routes to `/(auth)/accept-terms`.
- All three terms toggles are required before continuing.
- After acceptance, Helix routes to `/(tabs)`.

## Email New User

Platforms: web and at least one native build.

1. Open `/sign-up`.
2. Tap `Continue with email`.
3. Enter a never-used email address.
4. Enter a valid password:
   - at least 8 characters
   - at least one letter
   - at least one number
5. Submit the form.

Expected result when Supabase email confirmation is OFF:

- Supabase creates a new email/password Auth user.
- Helix routes immediately to `/(auth)/accept-terms`.
- All three terms toggles are required before continuing.
- After acceptance, Helix routes to `/(tabs)`.

Expected result when Supabase email confirmation is ON:

- Helix shows the `Check your email` alert.
- The verification link completes account activation.
- After signing in, Helix routes to `/(auth)/accept-terms` if terms are still
  pending.
- After acceptance, Helix routes to `/(tabs)`.

## Supabase Verification

After each provider test, check Supabase Dashboard -> Authentication -> Users:

- A new user exists for the tested Apple, Google, or Email identity.
- The identity provider matches the method tested.
- The Auth user ID has a matching `profiles.user_id`.
- Provider display names are saved when returned:
  - Email uses the email prefix as initial `display_name`.
  - Apple and Google patch `display_name` when the provider returns a name.
- Terms acceptance stamps the profile after the user accepts:
  - `age_confirmed_at`
  - `terms_accepted_at`
  - `terms_version`
  - `privacy_accepted_at`
  - `disclaimer_accepted_at`

Founder status is best-effort and should not block sign-up. If slots remain,
the founder grant or banner may appear after sign-up; absence of the banner is
not a provider auth failure.

## Returning-User Sanity Check

After completing a new-user test and accepting terms:

1. Sign out from Settings.
2. Sign in again with the same provider identity.
3. Confirm Helix skips `/(auth)/accept-terms` and routes directly to `/(tabs)`.

For email, also verify the existing-account branch:

1. Go to `Continue with email`.
2. Enter an existing email with the correct password.
3. Confirm the `Welcome back` alert appears and sign-in completes.
4. Enter the same existing email with a wrong password.
5. Confirm the UI offers `Sign in instead` and `Forgot password`.
