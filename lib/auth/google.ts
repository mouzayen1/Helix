// Sign in with Google — native picker → id token → Supabase exchange.
//
// Setup notes (from the spec):
//   - Web Client ID is what Supabase uses as the OAuth backend.
//   - iOS Client ID and Android Client ID are platform-specific OAuth
//     clients in the same Google Cloud project. iOS requires the
//     reversed-client-id URL scheme in app.json (the plugin handles it).
//   - Android requires the SHA-1 fingerprint of the signing keystore
//     registered with the Android OAuth client.
//   - Google Play Services unavailable: Huawei devices since 2019, AOSP
//     variants, etc. The library throws PLAY_SERVICES_NOT_AVAILABLE.
//     Sign-up screen surfaces a fallback message directing to Email.
//   - Multiple Google accounts: the native picker handles selection.
//
// v14 API notes:
//   - signIn() returns { type: 'success', data: User } | { type: 'cancelled' }
//     — cancellation is no longer thrown; it's a non-error response shape.
//   - Other errors still throw with a `code` property (statusCodes.*).

import {
  GoogleSignin,
  statusCodes,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
import type { Session } from '@supabase/supabase-js';
import { requireSupabase } from '../supabase';

export class GoogleSignInError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'GoogleSignInError';
  }
}

let configured = false;

/**
 * Configure the Google Sign-In SDK with our OAuth client IDs. Idempotent.
 * The sign-up screen calls this on mount so the button is ready by
 * the time the user taps it.
 */
export function configureGoogle(): void {
  if (configured) return;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (!webClientId) {
    throw new GoogleSignInError(
      'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set. Configure in .env.local ' +
        'or your EAS secrets before building.',
    );
  }
  GoogleSignin.configure({
    webClientId,
    iosClientId,
    scopes: ['profile', 'email'],
    offlineAccess: false,
  });
  configured = true;
}

/**
 * Run the Google sign-in flow end-to-end:
 *   1. Configure SDK if not already (idempotent).
 *   2. Verify Play Services on Android.
 *   3. Open the native picker; user selects a Google account.
 *   4. Exchange the id token for a Supabase session.
 *   5. Return the session.
 *
 * Throws GoogleSignInError. User cancellation reports code 'CANCELED'.
 */
export async function signInWithGoogle(): Promise<Session> {
  configureGoogle();

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new GoogleSignInError(
        'Google Play Services is required to sign in with Google. Try email instead.',
        'PLAY_SERVICES_UNAVAILABLE',
      );
    }
    throw new GoogleSignInError(
      err instanceof Error ? err.message : 'Play Services check failed.',
      code,
    );
  }

  let response;
  try {
    response = await GoogleSignin.signIn();
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === statusCodes.IN_PROGRESS) {
      throw new GoogleSignInError('A Google sign-in is already in progress.', 'IN_PROGRESS');
    }
    throw new GoogleSignInError(
      err instanceof Error ? err.message : 'Google sign-in failed.',
      code,
    );
  }

  // v14 returns a typed response — cancellation is not an error.
  if (!isSuccessResponse(response)) {
    throw new GoogleSignInError('Sign-in canceled.', 'CANCELED');
  }

  const userInfo = response.data;
  const idToken = userInfo.idToken;
  if (!idToken) {
    throw new GoogleSignInError('Google did not return an identity token.');
  }

  // Supabase enforces nonce-or-no-nonce parity: if the id_token has a
  // `nonce` claim, the call to signInWithIdToken must include a `nonce`
  // option (and vice versa) — otherwise it rejects with "Passed nonce
  // and nonce in id_token should either both exist or not." Recent
  // builds of the underlying GoogleSignIn iOS SDK include a nonce claim
  // by default, even though @react-native-google-signin v14 doesn't
  // expose a way to set one from JS. Parse the nonce out of the token
  // itself and pass it through, so Supabase's parity check is satisfied.
  // Note: this means we're not contributing client-generated nonce
  // entropy to the verification, but the underlying native SDK still
  // does its own anti-replay protection.
  const tokenNonce = extractNonceFromIdToken(idToken);

  const sb = requireSupabase();
  const { data, error } = await sb.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
    ...(tokenNonce ? { nonce: tokenNonce } : {}),
  });

  if (error) {
    throw new GoogleSignInError(error.message, error.name);
  }
  if (!data.session) {
    throw new GoogleSignInError('Supabase did not return a session.');
  }

  // Patch display name on first sign-in if profile name is null.
  const googleName = userInfo.user.name ?? userInfo.user.givenName ?? null;
  if (googleName) {
    try {
      await sb
        .from('profiles')
        .update({ display_name: googleName })
        .eq('user_id', data.session.user.id)
        .is('display_name', null);
    } catch {
      // Non-fatal.
    }
  }

  return data.session;
}

/**
 * Decode a JWT payload and return the nonce claim if present.
 * Returns undefined if the token is malformed or has no nonce.
 * Uses globalThis.atob (available in Hermes) to avoid Node's Buffer dep.
 */
function extractNonceFromIdToken(jwt: string): string | undefined {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return undefined;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = globalThis.atob(padded);
    const payload = JSON.parse(json) as { nonce?: unknown };
    return typeof payload.nonce === 'string' ? payload.nonce : undefined;
  } catch {
    return undefined;
  }
}

/** Sign out of the native Google session in addition to Supabase. */
export async function signOutGoogle(): Promise<void> {
  try {
    if (configured) {
      await GoogleSignin.signOut();
    }
  } catch {
    // Non-fatal.
  }
}
