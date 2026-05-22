-- Exclude admin / test accounts from the founders' tier.
--
-- Problem: the Google Play reviewer (and any internal test account)
-- signs in like a normal user, so grant_founder_if_eligible() would
-- hand it one of the 100 permanent founder slots — burning a slot on
-- a throwaway login. Founder slots are non-recoverable by design
-- (see 0003/0004), so we must prevent the grant, not undo it after.
--
-- Fix: an email exclusion list checked inside the RPC. Excluded
-- emails never increment founder_counter and always return
-- is_founder = FALSE. The client (lib/auth/founder.ts) already
-- handles a non-founder result, so no app change is needed.
--
-- Apply order: after 0005_purge_deleted_accounts.sql.
--
-- ORDERING NOTE: add the review email to founder_excluded_emails
-- BEFORE that account first signs in — the grant runs on first
-- sign-in. (If it already signed in and took a slot, see the
-- cleanup block at the bottom.)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Exclusion list
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.founder_excluded_emails (
  email      TEXT PRIMARY KEY,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. grant_founder_if_eligible — same as 0004, plus an exclusion check
--    after the idempotency guard and before the counter is locked.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.grant_founder_if_eligible(user_uuid UUID)
RETURNS TABLE(is_founder BOOLEAN, founder_number INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_founder    BOOLEAN;
  existing_number     INTEGER;
  caller_email        TEXT;
  current_count       INTEGER;
  current_cap         INTEGER;
  new_founder_number  INTEGER;
BEGIN
  SELECT p.founder_status, p.founder_number, lower(p.email)
    INTO existing_founder, existing_number, caller_email
    FROM public.profiles p
   WHERE p.user_id = user_uuid;

  -- Idempotency: already-founder calls return the existing number.
  IF existing_founder THEN
    RETURN QUERY SELECT TRUE, existing_number;
    RETURN;
  END IF;

  -- Admin / test accounts are excluded — never consume a slot.
  IF caller_email IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.founder_excluded_emails e
        WHERE lower(e.email) = caller_email
     ) THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER;
    RETURN;
  END IF;

  -- Lock the counter row exclusively. Concurrent calls serialize here.
  SELECT fc.count, fc.cap
    INTO current_count, current_cap
    FROM public.founder_counter fc
   WHERE fc.id = 1
   FOR UPDATE;

  IF current_count >= current_cap THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER;
    RETURN;
  END IF;

  new_founder_number := current_count + 1;

  UPDATE public.founder_counter fc
     SET count = new_founder_number,
         updated_at = NOW()
   WHERE fc.id = 1;

  UPDATE public.profiles p
     SET founder_status = TRUE,
         founder_number = new_founder_number,
         founder_granted_at = NOW()
   WHERE p.user_id = user_uuid;

  RETURN QUERY SELECT TRUE, new_founder_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_founder_if_eligible(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Register the review / admin account(s).
--    >>> EDIT the email to the one you'll use for the Play review login,
--        then this INSERT is safe to re-run (ON CONFLICT no-ops). <<<
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.founder_excluded_emails (email, note) VALUES
  ('review@gethelixapp.org', 'Google Play review / admin test account')
ON CONFLICT (email) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CLEANUP (only if the review account ALREADY signed in and took a
--    slot before this migration). Uncomment, set the email, and run:
--
-- WITH victim AS (
--   SELECT user_id, founder_number
--     FROM public.profiles
--    WHERE lower(email) = lower('review@gethelixapp.org')
--      AND founder_status
-- )
-- UPDATE public.profiles p
--    SET founder_status = FALSE, founder_number = NULL, founder_granted_at = NULL
--   FROM victim v
--  WHERE p.user_id = v.user_id;
-- -- give the freed slot back:
-- UPDATE public.founder_counter SET count = count - 1 WHERE id = 1 AND count > 0;
