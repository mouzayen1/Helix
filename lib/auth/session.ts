// Session manager — bridge between Supabase's auth state and the rest
// of the app.
//
// Responsibilities:
//   1. Subscribe to Supabase's `onAuthStateChange` and push the current
//      user_id into `lib/db.ts` via setCurrentUserId(). Every user-owned
//      query reads from that module state.
//   2. Expose a `hydrate()` function the root layout calls on launch —
//      reads the persisted session from AsyncStorage and primes the
//      user context BEFORE any screen renders. If a session exists and
//      hasn't expired beyond refresh, the user lands directly on the
//      app; otherwise on the sign-up screen.
//   3. Expose `signOut()` for the Settings → Account flow.
//
// The session storage is owned by Supabase (AsyncStorage adapter wired
// in lib/supabase.ts). This module doesn't read or write the raw
// session — it only listens for changes Supabase publishes.

import type { Session, Subscription } from '@supabase/supabase-js';
import { setCurrentUserId } from '../db';
import { isAuthConfigured, supabase } from '../supabase';
import { clearTermsStatusCache } from './terms-status';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: Session };

let currentState: AuthState = { status: 'loading' };
const listeners = new Set<(s: AuthState) => void>();
let supabaseSub: Subscription | null = null;

function syncDbUserContext(state: AuthState): void {
  setCurrentUserId(state.status === 'signed-in' ? state.session.user.id : null);
}

function setState(next: AuthState) {
  syncDbUserContext(next);
  currentState = next;
  for (const l of listeners) l(next);
}

/**
 * Reads the persisted session on app launch. Resolves once Supabase has
 * had a chance to hydrate and refresh tokens if needed. After this
 * resolves, `getAuthState()` returns the final state ('signed-in' or
 * 'signed-out') and the user_id has been pushed into lib/db.ts if
 * applicable.
 *
 * Safe to call when Supabase isn't configured — short-circuits to
 * 'signed-out' so the legacy local-only flow can take over.
 */
export async function hydrateSession(): Promise<AuthState> {
  if (!isAuthConfigured()) {
    setState({ status: 'signed-out' });
    return currentState;
  }
  const sb = supabase()!;
  const { data, error } = await sb.auth.getSession();
  if (error) {
    // Token unreadable / expired beyond refresh. Treat as signed-out.
    setCurrentUserId(null);
    clearTermsStatusCache();
    setState({ status: 'signed-out' });
    return currentState;
  }
  if (data.session) {
    setCurrentUserId(data.session.user.id);
    setState({ status: 'signed-in', session: data.session });
  } else {
    setCurrentUserId(null);
    clearTermsStatusCache();
    setState({ status: 'signed-out' });
  }
  attachListenerOnce();
  return currentState;
}

/**
 * Subscribes to Supabase's auth state changes so SIGN_IN, SIGN_OUT,
 * and TOKEN_REFRESHED events update the local user context and
 * notify subscribers. Idempotent — only attaches once per process.
 */
function attachListenerOnce(): void {
  if (supabaseSub) return;
  const sb = supabase();
  if (!sb) return;
  const { data } = sb.auth.onAuthStateChange((_event, session) => {
    if (session) {
      setCurrentUserId(session.user.id);
      setState({ status: 'signed-in', session });
    } else {
      setCurrentUserId(null);
      clearTermsStatusCache();
      setState({ status: 'signed-out' });
    }
  });
  supabaseSub = data.subscription;
}

/** Read the current auth state synchronously. */
export function getAuthState(): AuthState {
  syncDbUserContext(currentState);
  return currentState;
}

/** Subscribe to auth state changes. Returns the unsubscribe function. */
export function subscribeAuth(listener: (s: AuthState) => void): () => void {
  listeners.add(listener);
  // Fire immediately with the current state so subscribers don't have
  // to special-case "haven't received an event yet".
  syncDbUserContext(currentState);
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Sign out everywhere. Clears the Supabase session (which clears the
 * AsyncStorage entry and fires the auth state listener) and lets the
 * onAuthStateChange callback above push the user context to null.
 *
 * Local SQLite data is NOT deleted — re-signing in with the same
 * account reattaches via user_id filtering, and signing in as a
 * different user simply queries against a different user_id (empty
 * result set until they log new data).
 */
export async function signOut(): Promise<void> {
  const sb = supabase();
  if (!sb) {
    // No backend configured; legacy flow has no concept of sign-out.
    return;
  }
  await sb.auth.signOut();
  // The auth listener will fire and push state to 'signed-out'.
}
