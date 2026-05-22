-- Fix grant_founder_if_eligible RPC ambiguity bug.
--
-- The original function in 0001_init_auth_profiles.sql declared
--   RETURNS TABLE(is_founder BOOLEAN, founder_number INTEGER)
-- which creates an OUT parameter named `founder_number`. That collides
-- with the `profiles.founder_number` column reference inside the
-- function body — PostgreSQL throws 42702 "column reference is
-- ambiguous" before it gets to the FOR UPDATE lock, so no founder
-- slot is ever granted.
--
-- Fix: qualify every column reference with the table alias `p` so
-- `p.founder_number` is unambiguous. The function's return shape and
-- client-side call site stay identical — the row keys `is_founder`
-- and `founder_number` match what lib/auth/founder.ts reads.

CREATE OR REPLACE FUNCTION public.grant_founder_if_eligible(user_uuid UUID)
RETURNS TABLE(is_founder BOOLEAN, founder_number INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_founder    BOOLEAN;
  existing_number     INTEGER;
  current_count       INTEGER;
  current_cap         INTEGER;
  new_founder_number  INTEGER;
BEGIN
  -- Idempotency: already-founder calls return the existing number
  -- without touching the counter. Table-qualified column references
  -- to avoid the OUT-parameter collision that broke this in 0001.
  SELECT p.founder_status, p.founder_number
    INTO existing_founder, existing_number
    FROM public.profiles p
   WHERE p.user_id = user_uuid;

  IF existing_founder THEN
    RETURN QUERY SELECT TRUE, existing_number;
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
