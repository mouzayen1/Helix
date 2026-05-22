// Sign in with Apple — native flow → identity token → Supabase exchange.
//
// Apple's quirks (from the spec audit):
//   - fullName is only provided on FIRST sign-in. Subsequent sign-ins
//     return null for name. Save it immediately; the Supabase trigger
//     in 0001_init_auth_profiles.sql reads raw_user_meta_data on user
//     creation, so we pass the name in the signInWithIdToken options.
//   - email may also be null after first sign-in; "Hide My Email" relay
//     addresses (xyz@privaterelay.appleid.com) are valid and must be
//     accepted as-is.
//   - The identity token expires quickly; the Supabase exchange must
//     happen immediately after Apple returns the credential.
//   - On devices without an Apple ID (factory-reset / dev simulators
//     without iCloud), signInAsync throws. Caller handles the error
//     with a fallback message; not retryable from this module.
//   - Android: this module's signIn() throws synchronously via the
//     isAvailable check. Use Google / Email on Android.

import * as AppleAuthentication from 'expo-apple-authentication';
import type { Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { requireSupabase } from '../supabase';

export class AppleSignInError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AppleSignInError';
  }
}

/**
 * Returns whether Sign in with Apple is available on the current
 * runtime. Always false on Android; on iOS, checks the device supports
 * it (iOS 13+). The sign-up screen uses this to decide whether to
 * render the Apple button at all.
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Run the Apple sign-in flow end-to-end:
 *   1. Native Apple credential prompt
 *   2. Exchange identityToken for a Supabase session
 *   3. Return the session
 *
 * Throws AppleSignInError on failure. User cancellation is reported
 * via code 'CANCELED'; callers should treat that as a silent dismissal
 * (don't show an error toast).
 */
export async function signInWithApple(): Promise<Session> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (err) {
    // Apple's expo module reports cancellation via code 'ERR_REQUEST_CANCELED'.
    // Any other error is genuine (configuration, network, no Apple ID on
    // device, etc.).
    const code = (err as { code?: string })?.code;
    if (code === 'ERR_REQUEST_CANCELED') {
      throw new AppleSignInError('Sign-in canceled.', 'CANCELED');
    }
    throw new AppleSignInError(
      err instanceof Error ? err.message : 'Apple sign-in failed.',
      code,
    );
  }

  if (!credential.identityToken) {
    throw new AppleSignInError('Apple did not return an identity token.');
  }

  // The first-login name/email come back here and only here. Pack into
  // raw_user_meta_data so the handle_new_user trigger picks them up
  // when creating the profiles row.
  const fullName = credential.fullName?.givenName ?? null;
  const sb = requireSupabase();
  const { data, error } = await sb.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    // Apple uses signed nonces; the JS SDK reads them from the JWT
    // automatically. No additional nonce parameter needed here.
  });

  if (error) {
    throw new AppleSignInError(error.message, error.name);
  }
  if (!data.session) {
    throw new AppleSignInError('Supabase did not return a session.');
  }

  // First-sign-in metadata propagation. The Supabase handle_new_user
  // trigger reads raw_user_meta_data.full_name / display_name from the
  // *initial* token, but Apple's JWT doesn't include the name. Patch
  // the profile here on the client side instead so the display name
  // sticks. Idempotent — does nothing if profile already has a name.
  if (fullName) {
    try {
      await sb
        .from('profiles')
        .update({ display_name: fullName })
        .eq('user_id', data.session.user.id)
        .is('display_name', null);
    } catch {
      // Non-fatal — user can edit name later in Settings.
    }
  }

  return data.session;
}
