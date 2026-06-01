-- Web-app parity: bring the Supabase schema up to match the local SQLite
-- schema (lib/db.ts) so the online-first web build (lib/db.web.ts) is a
-- 1:1 mapping with no data loss. The original 0001/0002 mirror was
-- approximate — several columns the app's TypeScript types and screens
-- depend on were missing server-side. All additions here are ADDITIVE
-- and nullable / defaulted, so applying this is low-risk for the live
-- production database and the shipping native app (which ignores them).
--
-- Apply order: after 0006. Apply via Supabase dashboard → SQL Editor, or
--   psql "$DATABASE_URL" -f supabase/migrations/0007_web_schema_parity.sql
--
-- SAFETY (per CLAUDE.md): before applying, confirm you are in the correct
--   Supabase project — the one whose ref matches EXPO_PUBLIC_SUPABASE_URL
--   (https://<ref>.supabase.co). NOTE: 37ad6fea-… in app.json is the
--   Expo/EAS project id, NOT the Supabase project ref.

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles — onboarding gating fields RootGate / lib/db Profile type need.
-- (age_gate_accepted_at ↔ age_confirmed_at is handled by code mapping in
--  lib/db.web.ts, not a column. display_name/terms_version/theme/units/
--  dose_unit_pref/notif_prefs_json/dismissed_banners/biometric_lock/
--  notifications_enabled/disclaimer_accepted_at already exist in 0001.)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_year      INTEGER,
  -- Defaults FALSE: a brand-new web profile (created by handle_new_user)
  -- correctly runs onboarding on web. Existing native-origin profiles are
  -- treated as new-to-web and re-run onboarding there (their local
  -- onboarding state lives only on-device). No timestamp-derivation —
  -- the choose-path / preferences steps have no timestamp, so deriving
  -- "done" from terms/age stamps would mark users done too early.
  ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN NOT NULL DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────────────────────
-- journal_entries — local JournalEntry carries id + libido + recovery +
-- tags_json + body. Server 0002 only had mood/energy/sleep_*/note. Add the
-- rest so journal entries round-trip without dropping fields.
-- PK stays (user_id, entry_date); id is a mirrored convenience column.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS id        TEXT,
  ADD COLUMN IF NOT EXISTS libido    INTEGER,
  ADD COLUMN IF NOT EXISTS recovery  INTEGER,
  ADD COLUMN IF NOT EXISTS tags_json TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS body      TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- dose_skips — local DoseSkip carries a free-text note; server 0002 omitted it.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.dose_skips
  ADD COLUMN IF NOT EXISTS note TEXT;
