// Terms-acceptance lookup + reactive cache — used by sign-in handlers
// AND the root gate to decide whether a freshly authenticated user
// needs to pass through /(auth)/accept-terms or can go straight to
// /(tabs).
//
// The Supabase `profiles` row is the source of truth: `terms_accepted_at`
// is set (and `terms_version` matches the current TERMS_VERSION) iff the
// user has accepted the live terms. If either is missing, the user is
// routed to accept-terms. This keeps the legal audit trail intact and
// re-prompts the user whenever the terms version bumps.
//
// A module-level cache + subscription pattern lets the root gate keep
// its termsState in sync after the accept-terms screen saves. The
// alternative (re-fetching profile on every routing effect) was
// wasteful; deriving from the local profile would be incorrect because
// the local profile row is shared across sign-ins on the same device.
//
// Failure mode: any error (network, RLS, missing row) is treated as
// "pending" so we never silently skip a required acceptance.

import { TERMS_VERSION } from '../disclaimers';
import { requireSupabase } from '../supabase';

export type TermsStatus = 'accepted' | 'pending';

let cachedStatus: TermsStatus | null = null;
let cachedUserId: string | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export async function fetchTermsStatus(userId: string): Promise<TermsStatus> {
  try {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('profiles')
      .select('terms_accepted_at, terms_version')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return 'pending';
    if (!data.terms_accepted_at) return 'pending';
    if (data.terms_version !== TERMS_VERSION) return 'pending';
    return 'accepted';
  } catch {
    return 'pending';
  }
}

/** Synchronously read the cached terms status for `userId`. Returns null
 * if no fetch has run yet (or the cache is for a different user). */
export function getCachedTermsStatus(userId: string): TermsStatus | null {
  return cachedUserId === userId ? cachedStatus : null;
}

/** Fetch + cache. Notifies subscribers on completion. */
export async function refreshTermsStatus(userId: string): Promise<TermsStatus> {
  const status = await fetchTermsStatus(userId);
  cachedStatus = status;
  cachedUserId = userId;
  notify();
  return status;
}

/** Called by /(auth)/accept-terms after the Supabase update succeeds.
 *  Lets the root gate skip a re-fetch and route to /(tabs) immediately. */
export function markTermsAccepted(userId: string): void {
  cachedStatus = 'accepted';
  cachedUserId = userId;
  notify();
}

/** Cleared when the user signs out. Prevents the next user on the same
 *  device from inheriting the previous cache entry. */
export function clearTermsStatusCache(): void {
  cachedStatus = null;
  cachedUserId = null;
  notify();
}

export function subscribeTermsStatus(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * After a successful sign-in, returns the route to replace to. Returning
 * users with a stamped acceptance for the current terms version go
 * straight to /(tabs); everyone else passes through accept-terms.
 *
 * Side effect: populates the cache so the root gate observes the same
 * decision without a second network round-trip.
 */
export async function nextRouteAfterSignIn(userId: string): Promise<string> {
  const status = await refreshTermsStatus(userId);
  return status === 'accepted' ? '/(tabs)' : '/(auth)/accept-terms';
}
