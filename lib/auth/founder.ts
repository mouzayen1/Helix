// Founders' tier client — wraps the grant_founder_if_eligible RPC and
// the founder_counter table reads.
//
// The RPC (defined in supabase/migrations/0001_init_auth_profiles.sql)
// does the actual work atomically via FOR UPDATE locking. This file is
// the thin client wrapper plus the marketing read for the sign-up
// screen's "X spots left" counter.

import { requireSupabase, supabase } from '../supabase';

export type FounderGrant = {
  isFounder: boolean;
  founderNumber: number | null;
};

/**
 * Attempt to grant founder status to the given user. Idempotent: if
 * the user is already a founder, returns their existing number without
 * re-incrementing. If the 100-slot cap is reached, returns
 * { isFounder: false, founderNumber: null }.
 *
 * Called automatically by the post-signup flow (slice A1's session
 * manager will gain this hook in slice A3 when the sign-up screen
 * wires up). Safe to call multiple times for the same user.
 *
 * Throws on RPC error (network, permissions). Callers should treat
 * a thrown error as "founder status unknown" — log it, continue with
 * the signup flow, and check again on next launch.
 */
export async function grantFounderIfEligible(userId: string): Promise<FounderGrant> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('grant_founder_if_eligible', {
    user_uuid: userId,
  });
  if (error) {
    throw new Error(`grant_founder_if_eligible failed: ${error.message}`);
  }
  // The RPC returns an array of rows (TABLE return type). We expect
  // exactly one. Defensive-read in case the function shape changes.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { isFounder: false, founderNumber: null };
  }
  return {
    isFounder: !!row.is_founder,
    founderNumber: row.founder_number ?? null,
  };
}

/**
 * Read the public founder counter for the marketing "X spots left"
 * surface on the sign-up screen. Anyone (including unauthenticated
 * users) can read this via the RLS policy in the migration. Errors are
 * non-fatal — the sign-up screen simply hides the counter on failure.
 *
 * Returns null if the read fails or the counter row doesn't exist.
 */
export async function getFounderCounter(): Promise<{
  count: number;
  cap: number;
  spotsLeft: number;
} | null> {
  const sb = supabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('founder_counter')
      .select('count, cap')
      .eq('id', 1)
      .single();
    if (error || !data) return null;
    const count = Number(data.count) || 0;
    const cap = Number(data.cap) || 0;
    return { count, cap, spotsLeft: Math.max(0, cap - count) };
  } catch {
    return null;
  }
}

/**
 * Read the current user's founder status from their profile row. Used
 * by Settings → Account to render the founder badge, and by the post-
 * signup flow to decide whether to show the celebration banner.
 *
 * Returns null when not signed in or on read error.
 */
export async function getMyFounderStatus(): Promise<{
  isFounder: boolean;
  founderNumber: number | null;
  bannerSeenAt: string | null;
} | null> {
  const sb = supabase();
  if (!sb) return null;
  try {
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return null;
    const { data, error } = await sb
      .from('profiles')
      .select('founder_status, founder_number, founder_banner_seen_at')
      .eq('user_id', user.id)
      .single();
    if (error || !data) return null;
    return {
      isFounder: !!data.founder_status,
      founderNumber: data.founder_number ?? null,
      bannerSeenAt: data.founder_banner_seen_at ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Mark the founder celebration banner as seen so it doesn't re-show on
 * subsequent launches. Idempotent. Called once when the user dismisses
 * the celebration modal.
 */
export async function markFounderBannerSeen(userId: string): Promise<void> {
  const sb = requireSupabase();
  await sb
    .from('profiles')
    .update({ founder_banner_seen_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('founder_banner_seen_at', null);
}
