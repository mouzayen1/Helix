// Helix Supabase client — lazy, feature-flagged, RN-friendly.
//
// Design constraints:
//   - The client is instantiated only when EXPO_PUBLIC_SUPABASE_URL +
//     EXPO_PUBLIC_SUPABASE_ANON_KEY are both present at runtime. If
//     either is missing (e.g. local dev before the secrets land), the
//     getter returns null and `isAuthConfigured()` returns false. The
//     root layout's auth gate uses that signal to fall through to the
//     legacy local-only flow instead of crashing.
//
//   - Session storage uses AsyncStorage. The Supabase RN docs explicitly
//     recommend AsyncStorage over SecureStore because SecureStore on iOS
//     has a 2KB-per-item limit that Supabase's JWTs can occasionally
//     exceed (auth.users.user_metadata can grow). The session token itself
//     is not high-value secret material — it expires within hours and is
//     refreshed; long-lived secret is the refresh_token, which is
//     similarly rotated.
//
//   - autoRefreshToken is on; detectSessionInUrl is OFF (RN doesn't have
//     URL session detection — that's web-only).
//
//   - The client is a module-level singleton. Don't create multiple
//     clients; auth state listeners + session storage are designed
//     around exactly one.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/**
 * True when both Supabase env vars are present. The root layout's auth
 * gate uses this to decide whether to enforce sign-in or fall through
 * to the legacy local-only flow. Once the launch build ships, the
 * env vars are baked in via EAS and this is always true in production.
 */
export function isAuthConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Returns the singleton client. Lazily constructed on first call. Returns
 * null when env vars are missing — callers should guard with
 * `isAuthConfigured()` first.
 */
export function supabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (client) return client;
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Native has no URL session to detect. On web, the social-login
      // OAuth flow (lib/auth/*.web.ts) is a full-page redirect that returns
      // to the app origin with the session in the URL; detectSessionInUrl
      // lets supabase-js complete the exchange automatically on load.
      detectSessionInUrl: Platform.OS === 'web',
    },
  });
  return client;
}

/**
 * Throws if Supabase isn't configured. Use this inside auth flows that
 * have no fallback (e.g. inside the sign-up button handler — by the time
 * the user taps it, env vars must be present).
 */
export function requireSupabase(): SupabaseClient {
  const c = supabase();
  if (!c) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and ' +
        'EXPO_PUBLIC_SUPABASE_ANON_KEY in your env before building.',
    );
  }
  return c;
}
