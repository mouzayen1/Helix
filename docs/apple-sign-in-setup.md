# Apple Sign-In Setup

Use these values for Helix:

- iOS Bundle ID: `com.omniaworks.helix`
- Apple Team ID: `PUHZTA99Y2`
- Supabase project ref: `fmmeapqiqujriggsmhzw`
- Supabase callback URL: `https://fmmeapqiqujriggsmhzw.supabase.co/auth/v1/callback`
- Supabase domain for Apple web config: `fmmeapqiqujriggsmhzw.supabase.co`
- App web origin: `https://app.gethelixapp.org`
- Suggested Services ID: `org.gethelixapp.helix.web`

## Apple Developer

1. Go to Apple Developer -> Certificates, Identifiers & Profiles -> Identifiers.
2. Select the App ID / Bundle ID: `com.omniaworks.helix`.
3. Enable **Sign in with Apple** for that App ID. Leave the server-to-server notification endpoint blank.
4. Back in Identifiers, click `+`.
5. Choose **Services ID**, then Continue.
6. Description: `Helix Web`
7. Identifier: `org.gethelixapp.helix.web`
8. Register it.
9. Open that Services ID.
10. Enable **Sign in with Apple** -> Configure.
11. Select primary App ID: `com.omniaworks.helix`.
12. Website URLs:
    - Domains and Subdomains: `fmmeapqiqujriggsmhzw.supabase.co`
    - Return URLs: `https://fmmeapqiqujriggsmhzw.supabase.co/auth/v1/callback`
13. Save.
14. Go to Keys -> `+`.
15. Name: `Helix Sign in with Apple`
16. Enable **Sign in with Apple**.
17. Configure it for primary App ID `com.omniaworks.helix`.
18. Register, download the `.p8` file, and save the Key ID. Apple only lets you download this file once.

## Supabase

1. Go to Supabase project `fmmeapqiqujriggsmhzw`.
2. Authentication -> Providers -> Apple.
3. Enable Apple.
4. Fill:
   - Services ID / Client ID: `org.gethelixapp.helix.web`
   - Team ID: `PUHZTA99Y2`
   - Key ID: the Apple Key ID from Apple Developer
   - Private key: full contents of the downloaded `.p8`
5. Authorized Client IDs: include both:
   - `org.gethelixapp.helix.web`
   - `com.omniaworks.helix`
6. Authentication -> URL Configuration:
   - Site URL: `https://app.gethelixapp.org`
   - Redirect URLs: add `https://app.gethelixapp.org`
7. Authentication -> Identity Linking: keep manual/provider linking enabled.

## Vercel

1. Project -> Settings -> Environment Variables.
2. Add:
   - `EXPO_PUBLIC_ENABLE_APPLE_WEB_SIGN_IN=true`
3. Redeploy the web app.

## iOS App

The repo already has the required Expo config:

- `ios.usesAppleSignIn: true`
- `expo-apple-authentication` in `plugins`

Expo enables the native capability for EAS builds. Apple and Supabase still need the Services ID and callback configuration above for web OAuth.

## Verification

For the full Apple / Google / Email new-user checklist, see
[`docs/auth-signup-testing.md`](./auth-signup-testing.md).

1. Visit `https://app.gethelixapp.org/sign-up`.
2. Confirm **Sign in with Apple** appears above Google.
3. Complete Apple auth with a normal email.
4. Complete Apple auth with Hide My Email.
5. Confirm Supabase creates or restores the expected user session.
6. Confirm Helix routes through founder grant / terms acceptance as expected.
7. Confirm Google and email sign-in still work.

## References

- [Supabase: Login with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- [Apple Developer: Configure Sign in with Apple for the web](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web)
- [Expo: AppleAuthentication](https://docs.expo.dev/versions/latest/sdk/apple-authentication/)
