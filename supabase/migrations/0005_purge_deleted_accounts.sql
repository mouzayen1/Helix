-- Scheduled hard-purge of soft-deleted accounts.
--
-- Closes the gap left by 0003_account_deletion.sql, whose closing
-- TODO deferred the actual purge to "a separate ops task." That task
-- is this migration.
--
-- Background:
--   0003's delete_my_account() RPC soft-deletes — it stamps
--   profiles.deleted_at = NOW() and nulls the identity columns
--   (display_name, email) on the profile row. The canonical email
--   still lives in auth.users until a hard delete runs. The published
--   Privacy Policy promises permanent deletion "within 30 days", so a
--   scheduled job must actually remove the auth.users row once the
--   grace period elapses.
--
-- Cascade guarantee (verified against 0001 + 0002):
--   public.profiles.user_id           -> auth.users(id) ON DELETE CASCADE
--   public.saved_peptides.user_id     -> auth.users(id) ON DELETE CASCADE
--   public.vials.user_id              -> auth.users(id) ON DELETE CASCADE
--   public.cycles.user_id             -> auth.users(id) ON DELETE CASCADE
--   public.stacks.user_id             -> auth.users(id) ON DELETE CASCADE
--   public.doses.user_id              -> auth.users(id) ON DELETE CASCADE
--   public.injection_sites_log.user_id-> auth.users(id) ON DELETE CASCADE
--   public.dose_skips.user_id         -> auth.users(id) ON DELETE CASCADE
--   public.journal_entries.user_id    -> auth.users(id) ON DELETE CASCADE
--   public.metrics.user_id            -> auth.users(id) ON DELETE CASCADE
--   So deleting the single auth.users row cascade-removes every trace
--   of the account. We never DELETE the public tables directly.
--
-- Founder slots are intentionally NOT reclaimed (see 0003 / 0004):
--   founder_counter never decrements, so purging a deleted founder
--   does not free their number. Nothing here touches founder_counter.
--
-- Apply order: after 0004_fix_grant_founder.sql.
--
-- PREREQUISITE — enable pg_cron once per project before applying:
--   Dashboard -> Database -> Extensions -> search "pg_cron" -> enable.
--   (Equivalently, the CREATE EXTENSION below; it is a no-op if the
--   extension is already enabled. On Supabase pg_cron installs into
--   the dedicated "cron" schema.)

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Extension
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. purge_deleted_accounts()
--
-- Hard-deletes auth.users rows whose profile was soft-deleted more
-- than 30 days ago, returning the number of accounts purged (handy for
-- spot-checking via `SELECT public.purge_deleted_accounts();`).
--
-- SECURITY DEFINER so the function runs as its owner (the postgres
-- role that applies this migration), which holds delete privileges on
-- the auth schema. The body has no caller-supplied input and is not
-- granted to application roles, so there is no injection or
-- privilege-escalation surface — it is reachable only from the cron
-- job scheduled below (and a superuser running it by hand).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.purge_deleted_accounts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  purged integer;
BEGIN
  WITH expired AS (
    SELECT user_id
      FROM public.profiles
     WHERE deleted_at IS NOT NULL
       AND deleted_at < NOW() - INTERVAL '30 days'
  ),
  removed AS (
    DELETE FROM auth.users
     WHERE id IN (SELECT user_id FROM expired)
    RETURNING id
  )
  SELECT count(*) INTO purged FROM removed;

  RETURN purged;
END;
$$;

-- Lock the function down: only its owner / superuser may execute it.
REVOKE ALL ON FUNCTION public.purge_deleted_accounts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_deleted_accounts() FROM authenticated;
REVOKE ALL ON FUNCTION public.purge_deleted_accounts() FROM anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Daily schedule (03:00 UTC)
--
-- Idempotent: unschedule any prior job of the same name before
-- (re)creating it, so re-applying this migration never stacks
-- duplicate jobs.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-deleted-accounts') THEN
    PERFORM cron.unschedule('purge-deleted-accounts');
  END IF;
END;
$$;

SELECT cron.schedule(
  'purge-deleted-accounts',
  '0 3 * * *',
  $$SELECT public.purge_deleted_accounts();$$
);
