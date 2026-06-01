// Sign in with Apple — WEB variant. Metro resolves this over apple.ts on
// the web target. expo-apple-authentication is a native module, so web
// uses Supabase's OAuth redirect flow ("Sign in with Apple" via the web
// provider) instead. Same redirect mechanics as google.web.ts.
//
// Exports mirror apple.ts exactly so app/(auth)/sign-up.tsx is unchanged.
//
// Apple is currently HIDDEN on web (isAppleSignInAvailable returns false),
// so the sign-up screen renders only Google + Email — both of which work
// for iPhone Safari users. Apple's *web* "Sign in with Apple" needs extra
// setup the native app doesn't: an Apple Services ID, domain association,
// return URLs in the Apple Developer portal, and the Apple provider
// enabled for web in Supabase. The redirect-flow signInWithApple() below
// is left implemented so enabling it later is a one-line flip of the
// availability check once that config is done.

import type { Session } from '@supabase/supabase-js';
import { requireSupabase } from '../supabase';

export class AppleSignInError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AppleSignInError';
  }
}

/**
 * Hidden on web for now — see the file header. Flip to `true` (Apple's web
 * OAuth provider works in any browser) once the Apple-web + Supabase
 * config is in place.
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
  return false;
}

/**
 * Kick off the Apple OAuth redirect. On success the browser navigates
 * away to Apple, so this promise intentionally never resolves — the
 * session is established after the redirect returns and picked up by
 * RootGate. Throws AppleSignInError only when the redirect can't start.
 */
export async function signInWithApple(): Promise<Session> {
  const sb = requireSupabase();
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: window.location.origin },
  });
  if (error) {
    throw new AppleSignInError(error.message, error.name);
  }
  // Browser is redirecting to Apple; nothing left to resolve here.
  return new Promise<Session>(() => {});
}
