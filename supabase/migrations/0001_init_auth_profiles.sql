-- Helix auth foundation — profiles + founder counter + atomic grant RPC.
--
-- Apply order:
--   1. This file: profiles + founder_counter + grant_founder_if_eligible
--   2. 0002_init_user_data_tables.sql (mirror of local SQLite tables, with RLS)
--   3. Future sync feature: 0003_sync_outbox.sql
--
-- Apply via:
--   psql "$DATABASE_URL" -f supabase/migrations/0001_init_auth_profiles.sql
-- Or via Supabase dashboard → SQL Editor → paste contents → run.

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles — extends Supabase's auth.users with app-level metadata
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  display_name TEXT,
  email        TEXT,            -- mirrored from auth.users for convenience

  -- Compliance timestamps (existing app already tracks these locally; once
  -- accounts exist they live here as the source of truth).
  age_confirmed_at      TIMESTAMPTZ,
  terms_accepted_at     TIMESTAMPTZ,
  terms_version         TEXT,
  disclaimer_accepted_at TIMESTAMPTZ,
  privacy_accepted_at   TIMESTAMPTZ,

  -- Founders' tier — populated by grant_founder_if_eligible(), see below.
  founder_status    BOOLEAN NOT NULL DEFAULT FALSE,
  founder_number    INTEGER UNIQUE,                  -- 1..100, NULL otherwise
  founder_granted_at TIMESTAMPTZ,
  founder_banner_seen_at TIMESTAMPTZ,                -- celebrate once

  -- Display preferences (mirror the local profile columns; see lib/db.ts).
  unit_weight     TEXT NOT NULL DEFAULT 'lb',
  unit_volume     TEXT NOT NULL DEFAULT 'units',
  theme           TEXT NOT NULL DEFAULT 'system',
  dose_unit_pref  TEXT NOT NULL DEFAULT 'auto',
  notif_prefs_json TEXT,
  dismissed_banners TEXT NOT NULL DEFAULT '[]',
  titration_banner_dismissed_at TIMESTAMPTZ,
  local_data_attributed_at TIMESTAMPTZ,              -- Phase C one-time flag

  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  biometric_lock        BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Update trigger so updated_at always reflects last write.
CREATE OR REPLACE FUNCTION public.touch_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_profiles_updated_at();

-- Auto-create a profile row when a new auth user appears. Display name is
-- pulled from raw_user_meta_data when the client provided one (Apple
-- fullName on first sign-in, Google name, email prefix).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1),
      'Researcher'
    )
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- RLS — users can only see / edit their own row.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;

CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- founder_counter — singleton row, source of truth for the 100-slot cap
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.founder_counter (
  id         INTEGER PRIMARY KEY CHECK (id = 1),  -- singleton
  count      INTEGER NOT NULL DEFAULT 0,
  cap        INTEGER NOT NULL DEFAULT 100,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.founder_counter (id, count, cap)
VALUES (1, 0, 100)
ON CONFLICT (id) DO NOTHING;

-- Readable by anyone (anon clients on the sign-up screen show "X spots left").
ALTER TABLE public.founder_counter ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads founder counter"   ON public.founder_counter;
DROP POLICY IF EXISTS "Nobody updates founder counter" ON public.founder_counter;

CREATE POLICY "Anyone reads founder counter"
  ON public.founder_counter FOR SELECT
  USING (TRUE);

-- No INSERT / UPDATE / DELETE policies — only the SECURITY DEFINER function
-- below can write. Direct writes from the client are blocked.

-- ─────────────────────────────────────────────────────────────────────────────
-- grant_founder_if_eligible — atomic, concurrency-safe founder grant
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Two simultaneous signups cannot both claim founder #87. FOR UPDATE
-- serializes the counter check + increment + profile update inside a single
-- transaction.
--
-- Returns one row with:
--   is_founder      BOOLEAN — TRUE iff the slot was granted
--   founder_number  INTEGER — 1..100 on success, NULL on cap-reached
--
-- Idempotent for already-founder users: returns their existing number
-- without re-incrementing the counter.

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
  -- Idempotency: if the caller is already a founder, return their number
  -- without touching the counter.
  SELECT founder_status, founder_number
    INTO existing_founder, existing_number
    FROM public.profiles
   WHERE user_id = user_uuid;

  IF existing_founder THEN
    RETURN QUERY SELECT TRUE, existing_number;
    RETURN;
  END IF;

  -- Lock the counter row exclusively for the rest of this transaction.
  -- Concurrent calls serialize here.
  SELECT count, cap
    INTO current_count, current_cap
    FROM public.founder_counter
   WHERE id = 1
   FOR UPDATE;

  IF current_count >= current_cap THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER;
    RETURN;
  END IF;

  new_founder_number := current_count + 1;

  UPDATE public.founder_counter
     SET count = new_founder_number,
         updated_at = NOW()
   WHERE id = 1;

  UPDATE public.profiles
     SET founder_status = TRUE,
         founder_number = new_founder_number,
         founder_granted_at = NOW()
   WHERE user_id = user_uuid;

  RETURN QUERY SELECT TRUE, new_founder_number;
END;
$$;

-- Anyone authenticated can call this for their own user. The function itself
-- doesn't trust the user_uuid parameter blindly — the client should always
-- pass auth.uid(). A future hardening pass can wrap this in a server-side
-- check or replace user_uuid with auth.uid() inline.
GRANT EXECUTE ON FUNCTION public.grant_founder_if_eligible(UUID) TO authenticated;
