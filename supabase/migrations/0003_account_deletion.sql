-- Account deletion — in-app delete flow required by App Store
-- Guideline 5.1.1(v) and Play Store equivalent. The user taps
-- "Delete account" in Settings, types DELETE to confirm, and this
-- RPC fires. Server side:
--
--   1. Sets profiles.deleted_at = NOW() on the caller's row.
--   2. Returns the timestamp so the client can display "deleted on …".
--
-- Permanent purge (DELETE FROM auth.users + cascade) happens via a
-- scheduled job 30 days later. The 30-day window gives users a
-- grace period to recover from accidental deletion (out of scope
-- for this commit — see notes at bottom).
--
-- Founder slots are NOT recovered when a founder account is
-- deleted. The founder_counter does not decrement. This is
-- intentional (prevents gaming via delete-and-resignup to claim a
-- higher founder number).

-- Apply order: after 0002_init_user_data_tables.sql.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_deleted_at_idx
  ON public.profiles (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- delete_my_account
--
-- Caller-scoped soft delete. Uses auth.uid() directly so a malicious
-- client can't pass another user's UUID. SECURITY DEFINER lets the
-- function bypass RLS when stamping the deletion timestamp, but the
-- auth.uid() restriction keeps the blast radius to the caller's own
-- row.

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid       UUID;
  marked_at TIMESTAMPTZ;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No active user';
  END IF;

  marked_at := NOW();

  UPDATE public.profiles
     SET deleted_at = marked_at,
         -- Wipe the display name + email mirror so the soft-deleted
         -- row stops surfacing the user's identity. The auth.users
         -- row still holds the canonical email until the 30-day
         -- purge runs.
         display_name = NULL,
         email = NULL,
         updated_at = marked_at
   WHERE user_id = uid;

  RETURN marked_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- TODO (separate ops task, NOT part of this migration):
--
-- Schedule a pg_cron job (or Supabase Edge Function with a cron trigger)
-- that runs daily and:
--
--   1. Selects auth.users rows whose corresponding profiles.deleted_at
--      is older than 30 days.
--   2. Calls auth.admin.delete_user() (or the equivalent admin RPC)
--      on each one.
--
-- That cascades:
--   - profiles row deletes via the existing FK ON DELETE CASCADE
--   - all user-data rows (vials, cycles, stacks, doses,
--     injection_sites_log, dose_skips, journal_entries, metrics,
--     saved_peptides) cascade-delete via their FKs from 0002.
--
-- Until that scheduled job is in place, deleted users remain in
-- auth.users (soft-deleted via profiles.deleted_at) but their
-- profile reads return a wiped row. From the app's perspective the
-- account is gone; from the database's perspective it's pending
-- purge. Apple Review accepts this pattern as long as the in-app
-- flow lands the user on "Your account is being deleted."
-- ─────────────────────────────────────────────────────────────────────────────
