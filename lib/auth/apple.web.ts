// Sign in with Apple — WEB variant. Metro resolves this over apple.ts on
// the web target. expo-apple-authentication is a native module, so web
// uses Supabase's OAuth redirect flow ("Sign in with Apple" via the web
// provider) instead. Same redirect mechanics as google.web.ts.
//
// Exports mirror apple.ts exactly so app/(auth)/sign-up.tsx is unchanged.
//
// Apple's *web* "Sign in with Apple" needs setup the native app doesn't:
// an Apple Services ID, domain association + return URLs in the Apple
// Developer portal, and the Apple provider enabled for web in Supabase.
// Because clicking the button before that config exists would just error,
// it's gated behind the EXPO_PUBLIC_ENABLE_APPLE_WEB_SIGN_IN feature flag
// (see isAppleSignInAvailable). Set the flag to "true" in the web build's
// env (Vercel) once the Apple + Supabase config is complete, then redeploy.

import type { Session } from '@supabase/supabase-js';
import { requireSupabase } from '../supabase';

export class AppleSignInError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AppleSignInError';
  }
}

/**
 * Apple "Sign in with Apple" on web is gated behind an explicit feature
 * flag so the button only appears once the supporting Apple Developer +
 * Supabase config is in place (otherwise clicking it errors).
 *
 * Set EXPO_PUBLIC_ENABLE_APPLE_WEB_SIGN_IN=true in the web build env
 * (Vercel → Settings → Environment Variables) and redeploy AFTER the
 * config is complete. The flag is read from the bundle at runtime; the
 * value is inlined by Expo at export time. Native iOS is unaffected — it
 * resolves apple.ts (not this file) and keeps its own device check.
 */
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
