// Platform-neutral data types + plain constants shared by the two data
// layer implementations:
//   - lib/db.ts      (native: expo-sqlite, source of truth on iOS/Android)
//   - lib/db.web.ts  (web: Supabase, source of truth in the browser)
//
// Nothing here may import a native-only module (expo-sqlite, etc.) so the
// web bundle stays clean. db.ts and db.web.ts both re-export these so that
// existing `import { type Vial } from '@/lib/db'` call sites resolve on
// every platform. db.web.ts cannot import types from './db' directly —
// on web Metro resolves './db' back to './db.web' (a circular self-import)
// — which is the whole reason this module exists.

// ---- Profile ---------------------------------------------------------------

export type Profile = {
  local_user_id: string;
  display_name: string | null;
  birth_year: number | null;
  unit_weight: 'lb' | 'kg';
  unit_volume: 'units' | 'mL';
  theme: 'system' | 'light' | 'dark';
  terms_version: string | null;
  terms_accepted_at: string | null;
  age_gate_accepted_at: string | null;
  disclaimer_accepted_at: string | null;
  onboarding_done: 0 | 1;
  notifications_enabled: 0 | 1;
  biometric_lock: 0 | 1;
  notif_prefs_json: string | null;
  dismissed_banners: string;
  dose_unit_pref: 'auto' | 'mcg' | 'mg';
  local_data_attributed_at: string | null;
};

// ---- Vials -----------------------------------------------------------------

export type Vial = {
  id: string;
  peptide_id: string;
  strength_mg: number;
  bac_water_ml: number;
  concentration: number;
  remaining_mg: number;
  reconstituted_at: string;
  expires_at: string | null;
  notes: string | null;
  is_active: 0 | 1;
  cost_usd: number | null;
  depleted_at: string | null;
  first_used_at: string | null;
  total_doses_drawn: number;
  cycle_id: string | null;
};

export type DoseSkip = {
  id: string;
  peptide_id: string;
  cycle_id: string | null;
  scheduled_date: string;
  time_of_day: string | null;
  reason: string | null;
  note: string | null;
  created_at: string;
};

// ---- Doses -----------------------------------------------------------------

export type Dose = {
  id: string;
  peptide_id: string;
  vial_id: string | null;
  cycle_id: string | null;
  amount_mcg: number;
  volume_units: number | null;
  route: string;
  site: string | null;
  taken_at: string;
  note: string | null;
};

// ---- Cycles ----------------------------------------------------------------

export type Cycle = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  phase: 'loading' | 'active' | 'taper' | 'washout';
  status: 'planned' | 'active' | 'paused' | 'complete' | 'cancelled';
  stack_id: string | null;
  protocol_json: string;
  notes: string | null;
  created_at: string;
  paused_at: string | null;
  paused_total_days: number;
};

export type CycleProtocolItemPhase = {
  startWeek: number;
  name?: string;
  freq: string;
  dose_mcg?: number;
};

export type CycleProtocolItem = {
  peptide_id: string;
  dose_mcg: number;
  freq: string;
  time_of_day: string;
  phases?: CycleProtocolItemPhase[];
};

// ---- Stacks ----------------------------------------------------------------

export type StackItem = {
  peptide_id: string;
  dose_mcg: number;
  unit: 'mcg' | 'mg';
  freq: string;
  time: string;
};

export type Stack = {
  id: string;
  name: string;
  goal: string | null;
  items_json: string;
  synergy_score: number | null;
  created_at: string;
};

// ---- Journal ---------------------------------------------------------------

export type JournalEntry = {
  id: string;
  entry_date: string;
  mood: number | null;
  energy: number | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  libido: number | null;
  recovery: number | null;
  tags_json: string;
  body: string | null;
  created_at: string;
  updated_at: string;
};

// ---- Metrics ---------------------------------------------------------------

export type Metric = {
  id: string;
  kind: string;
  value: number;
  unit: string | null;
  taken_at: string;
  source: string;
  note: string | null;
};

export const METRIC_KINDS = [
  { id: 'weight', label: 'Weight', unit: 'lb' },
  { id: 'hr_resting', label: 'Resting HR', unit: 'bpm' },
  { id: 'sleep_hours', label: 'Sleep', unit: 'h' },
  { id: 'sleep_score', label: 'Sleep score', unit: '/100' },
  { id: 'igf1', label: 'IGF-1', unit: 'ng/mL' },
  { id: 'glucose', label: 'Glucose', unit: 'mg/dL' },
  { id: 'bp_sys', label: 'Blood pressure (sys)', unit: 'mmHg' },
  { id: 'bp_dia', label: 'Blood pressure (dia)', unit: 'mmHg' },
  { id: 'waist', label: 'Waist', unit: 'in' },
  { id: 'body_fat', label: 'Body fat', unit: '%' },
] as const;

// ---- Injection-site rotation -----------------------------------------------

export const INJECTION_SITES = [
  'L.Deltoid', 'R.Deltoid',
  'L.Abdomen', 'R.Abdomen',
  'L.Hip', 'R.Hip',
  'L.Thigh', 'R.Thigh',
] as const;

export type SiteSuggestion = {
  site: string;
  days_since: number;
  total_uses: number;
  /** ISO timestamp of the most recent dose at this site, or null if never
   *  used. Lets callers render sub-day relative times (e.g. "18h ago")
   *  instead of the floored "0d ago" that days_since alone produces. */
  last_used: string | null;
};

// ---- Export ----------------------------------------------------------------

export const SCHEMA_VERSION = 2;
