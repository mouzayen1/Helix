-- Helix user-data tables on Supabase. Mirrors the local SQLite schema in
-- lib/db.ts so that future sync (v1.1+) is a one-to-one mapping without
-- field translation. Every table has user_id + RLS scoped to auth.uid().
--
-- Apply order: after 0001_init_auth_profiles.sql.
--
-- The local SQLite schema gets matching user_id columns via the existing
-- addColumnIfMissing pattern in lib/db.ts; that change ships with Phase C
-- of the auth feature. Until then this server-side schema sits unused.

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: standard "users access own rows" RLS policy applied to every table
-- ─────────────────────────────────────────────────────────────────────────────
-- (No helper function in Postgres — RLS policies must be created per-table.
-- The pattern below is repeated for each user-data table.)

-- ─────────────────────────────────────────────────────────────────────────────
-- saved_peptides
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.saved_peptides (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  peptide_id TEXT NOT NULL,
  saved_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, peptide_id)
);

ALTER TABLE public.saved_peptides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own saved_peptides" ON public.saved_peptides;
CREATE POLICY "Users access own saved_peptides"
  ON public.saved_peptides
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- vials
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vials (
  id                 TEXT PRIMARY KEY,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  peptide_id         TEXT NOT NULL,
  strength_mg        REAL NOT NULL,
  bac_water_ml       REAL NOT NULL,
  concentration      REAL NOT NULL,        -- mg per mL
  remaining_mg       REAL NOT NULL,
  is_active          INTEGER NOT NULL DEFAULT 1,
  reconstituted_at   TEXT NOT NULL,
  expires_at         TEXT,
  cycle_id           TEXT,
  notes              TEXT,
  cost_usd           REAL,
  depleted_at        TEXT,
  first_used_at      TEXT,
  total_doses_drawn  INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vials_user_active_idx
  ON public.vials (user_id, is_active);

ALTER TABLE public.vials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own vials" ON public.vials;
CREATE POLICY "Users access own vials"
  ON public.vials
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- cycles
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cycles (
  id                 TEXT PRIMARY KEY,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  starts_on          TEXT NOT NULL,
  ends_on            TEXT,
  phase              TEXT,
  status             TEXT NOT NULL DEFAULT 'active',
  stack_id           TEXT,
  protocol_json      TEXT NOT NULL DEFAULT '[]',
  notes              TEXT,
  paused_at          TEXT,
  paused_total_days  INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cycles_user_status_idx
  ON public.cycles (user_id, status);

ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own cycles" ON public.cycles;
CREATE POLICY "Users access own cycles"
  ON public.cycles
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- stacks
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stacks (
  id             TEXT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  goal           TEXT,
  items_json     TEXT NOT NULL,
  synergy_score  REAL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own stacks" ON public.stacks;
CREATE POLICY "Users access own stacks"
  ON public.stacks
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- doses
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.doses (
  id             TEXT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  peptide_id     TEXT NOT NULL,
  vial_id        TEXT REFERENCES public.vials(id) ON DELETE SET NULL,
  cycle_id       TEXT REFERENCES public.cycles(id) ON DELETE SET NULL,
  amount_mcg     REAL NOT NULL,
  volume_units   REAL,
  route          TEXT,
  site           TEXT,
  taken_at       TEXT NOT NULL,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS doses_user_taken_idx
  ON public.doses (user_id, taken_at DESC);

ALTER TABLE public.doses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own doses" ON public.doses;
CREATE POLICY "Users access own doses"
  ON public.doses
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- injection_sites_log
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.injection_sites_log (
  id         TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site       TEXT NOT NULL,
  used_at    TEXT NOT NULL,
  dose_id    TEXT REFERENCES public.doses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sites_user_used_idx
  ON public.injection_sites_log (user_id, used_at DESC);

ALTER TABLE public.injection_sites_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own injection_sites_log" ON public.injection_sites_log;
CREATE POLICY "Users access own injection_sites_log"
  ON public.injection_sites_log
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- dose_skips
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dose_skips (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_id        TEXT REFERENCES public.cycles(id) ON DELETE CASCADE,
  peptide_id      TEXT NOT NULL,
  scheduled_date  TEXT NOT NULL,
  time_of_day     TEXT,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dose_skips_user_date_idx
  ON public.dose_skips (user_id, scheduled_date);

ALTER TABLE public.dose_skips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own dose_skips" ON public.dose_skips;
CREATE POLICY "Users access own dose_skips"
  ON public.dose_skips
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- journal_entries
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.journal_entries (
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date     TEXT NOT NULL,           -- YYYY-MM-DD
  mood           INTEGER,
  energy         INTEGER,
  sleep_hours    REAL,
  sleep_quality  INTEGER,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, entry_date)
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own journal_entries" ON public.journal_entries;
CREATE POLICY "Users access own journal_entries"
  ON public.journal_entries
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- metrics
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.metrics (
  id         TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  value      REAL NOT NULL,
  unit       TEXT,
  taken_at   TEXT NOT NULL,
  source     TEXT,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS metrics_user_kind_taken_idx
  ON public.metrics (user_id, kind, taken_at DESC);

ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own metrics" ON public.metrics;
CREATE POLICY "Users access own metrics"
  ON public.metrics
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
