-- Cross-device sync metadata: every user-data table needs an updated_at
-- column + AFTER UPDATE trigger so the native sync engine (lib/sync.ts)
-- can do delta pulls + pushes. Most tables in 0002 only had created_at.
-- This migration is purely additive and idempotent.
--
-- Backfill rule: rows that already exist get updated_at = created_at so
-- the first sync push doesn't try to overwrite remote with stale data
-- that just happened to have a fresh timestamp.
--
-- Apply via Supabase Dashboard → SQL Editor, or
--   psql "$DATABASE_URL" -f supabase/migrations/0008_sync_metadata.sql

-- Generic trigger function — reused for every table.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── saved_peptides ───────────────────────────────────────
ALTER TABLE public.saved_peptides
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE public.saved_peptides SET updated_at = COALESCE(saved_at, NOW()) WHERE updated_at IS NULL;
DROP TRIGGER IF EXISTS saved_peptides_touch_updated_at ON public.saved_peptides;
CREATE TRIGGER saved_peptides_touch_updated_at
  BEFORE UPDATE ON public.saved_peptides
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── vials ───────────────────────────────────────────────
ALTER TABLE public.vials
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE public.vials SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
DROP TRIGGER IF EXISTS vials_touch_updated_at ON public.vials;
CREATE TRIGGER vials_touch_updated_at
  BEFORE UPDATE ON public.vials
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── cycles ──────────────────────────────────────────────
ALTER TABLE public.cycles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE public.cycles SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
DROP TRIGGER IF EXISTS cycles_touch_updated_at ON public.cycles;
CREATE TRIGGER cycles_touch_updated_at
  BEFORE UPDATE ON public.cycles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── stacks ──────────────────────────────────────────────
ALTER TABLE public.stacks
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE public.stacks SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
DROP TRIGGER IF EXISTS stacks_touch_updated_at ON public.stacks;
CREATE TRIGGER stacks_touch_updated_at
  BEFORE UPDATE ON public.stacks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── doses ────────────────────────────────────────────────
ALTER TABLE public.doses
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE public.doses SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
DROP TRIGGER IF EXISTS doses_touch_updated_at ON public.doses;
CREATE TRIGGER doses_touch_updated_at
  BEFORE UPDATE ON public.doses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── metrics ──────────────────────────────────────────────
ALTER TABLE public.metrics
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE public.metrics SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
DROP TRIGGER IF EXISTS metrics_touch_updated_at ON public.metrics;
CREATE TRIGGER metrics_touch_updated_at
  BEFORE UPDATE ON public.metrics
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── injection_sites_log ──────────────────────────────────────
ALTER TABLE public.injection_sites_log
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE public.injection_sites_log SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
DROP TRIGGER IF EXISTS injection_sites_log_touch_updated_at ON public.injection_sites_log;
CREATE TRIGGER injection_sites_log_touch_updated_at
  BEFORE UPDATE ON public.injection_sites_log
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── dose_skips ──────────────────────────────────────────────
ALTER TABLE public.dose_skips
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE public.dose_skips SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
DROP TRIGGER IF EXISTS dose_skips_touch_updated_at ON public.dose_skips;
CREATE TRIGGER dose_skips_touch_updated_at
  BEFORE UPDATE ON public.dose_skips
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- journal_entries already has updated_at + a trigger from 0002. Skip.
-- profiles already has updated_at + a trigger from 0001. Skip.
