// Sign in with Google — WEB variant. Metro resolves this over google.ts
// on the web target. The native @react-native-google-signin SDK doesn't
// run in a browser, so web uses Supabase's OAuth redirect flow instead.
//
// Flow: signInWithOAuth({ provider: 'google' }) sets window.location to
// Google's consent screen. After the user authorizes, Google redirects
// back to the app origin, and supabase-js completes the OAuth session
// exchange on load (detectSessionInUrl is enabled on web in
// lib/supabase.ts; the default implicit flow returns the tokens in the
// URL fragment). The signed-in session is then picked up by
// hydrateSession() / onAuthStateChange in lib/auth/session.ts, and
// RootGate routes the user — so the founder grant + routing that the
// native sign-up handler does inline happen post-redirect in RootGate
// instead (the page has already navigated away by then).
//
// Exports mirror google.ts exactly so app/(auth)/sign-up.tsx is unchanged.

import type { Session } from '@supabase/supabase-js';
import { requireSupabase } from '../supabase';

export class GoogleSignInError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'GoogleSignInError';
  }
}

/** No native SDK to configure on web — kept for API parity. */
export function configureGoogle(): void {
  // no-op on web
}

/**
 * Kick off the Google OAuth redirect. On success the browser navigates
 * away to Google, so this promise intentionally never resolves — the
 * session is established after the redirect returns. Throws
 * GoogleSignInError only when the redirect can't be started.
 */
export async function signInWithGoogle(): Promise<Session> {
  const sb = requireSupabase();
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) {
    throw new GoogleSignInError(error.message, error.name);
  }
  // Browser is redirecting to Google; nothing left to resolve here.
  return new Promise<Session>(() => {});
}

/** Supabase signOut clears the web session; no separate SDK to sign out. */
export async function signOutGoogle(): Promise<void> {
  // no-op on web
}
