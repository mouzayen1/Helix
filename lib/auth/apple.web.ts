// Sign in with Apple — WEB variant. Metro resolves this over apple.ts on
// the web target. expo-apple-authentication is a native module, so web
// uses Supabase's OAuth redirect flow ("Sign in with Apple" via the web
// provider) instead. Same redirect mechanics as google.web.ts.
//
// Exports mirror apple.ts exactly so app/(auth)/sign-up.tsx is unchanged.
//
// Apple web sign-in is gated behind EXPO_PUBLIC_ENABLE_APPLE_WEB_SIGN_IN.
// Apple's web provider needs config outside the app bundle: a Services ID,
// domain association, return URLs in the Apple Developer portal, and the
// Apple provider enabled in Supabase. Keep the flag off until that config
// is live, then enable it in the web deployment environment.

import type { Session } from '@supabase/supabase-js';
import { requireSupabase } from '../supabase';

export class AppleSignInError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AppleSignInError';
  }
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  return process.env.EXPO_PUBLIC_ENABLE_APPLE_WEB_SIGN_IN === 'true';
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
