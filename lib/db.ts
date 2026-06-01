// Local SQLite — mirrors the Supabase schema in supabase/migrations/.
// All user-owned tables carry a user_id column (added in the auth
// migration); reads and writes filter / inject via setCurrentUserId() +
// requireUserId() helpers below. The peptides table is global reference
// data, no user_id.

import * as SQLite from 'expo-sqlite';
import { PEPTIDES } from './peptides';

// Shared, platform-neutral data types + plain constants. Canonical home is
// lib/db-types.ts so the native (this file) and web (db.web.ts) layers
// can't drift. Imported for local use below, then re-exported so existing
// `import { type Vial } from '@/lib/db'` call sites keep working.
import {
  METRIC_KINDS,
  INJECTION_SITES,
  SCHEMA_VERSION,
  type Profile,
  type Vial,
  type DoseSkip,
  type Dose,
  type Cycle,
  type CycleProtocolItemPhase,
  type CycleProtocolItem,
  type StackItem,
  type Stack,
  type JournalEntry,
  type Metric,
  type SiteSuggestion,
} from './db-types';

export {
  METRIC_KINDS,
  INJECTION_SITES,
  SCHEMA_VERSION,
  type Profile,
  type Vial,
  type DoseSkip,
  type Dose,
  type Cycle,
  type CycleProtocolItemPhase,
  type CycleProtocolItem,
  type StackItem,
  type Stack,
  type JournalEntry,
  type Metric,
  type SiteSuggestion,
};

const DB_NAME = 'helix.db';

let _db: SQLite.SQLiteDatabase | null = null;

function db(): SQLite.SQLiteDatabase {
  if (!_db) _db = SQLite.openDatabaseSync(DB_NAME);
  return _db;
}

/** Exported handle for the sync engine (lib/sync.ts). External callers
 *  should NOT use this for ad-hoc queries — go through the typed
 *  helpers below. */
export function getDb(): SQLite.SQLiteDatabase {
  return db();
}

// ---- Current user context -------------------------------------------------
//
// Auth-feature scaffolding. The session manager in lib/auth/session.ts
// pushes the active user_id here whenever Supabase reports a sign-in or
// sign-out; every user-owned query in this file reads from
// `requireUserId()` (added in Phase C). Pre-auth code paths
// (legacy local-only flow before EXPO_PUBLIC_SUPABASE_URL is set) leave
// the value at null — the actual query filtering hasn't shipped yet, so
// the null is currently inert.

let _currentUserId: string | null = null;

/**
 * Set or clear the active user. Called by lib/auth/session.ts on sign-in,
 * sign-out, and token-refresh events. Pure module state — no React
 * context, no Zustand — so it's reachable from non-React call sites
 * (notification scheduling, background jobs).
 */
export function setCurrentUserId(id: string | null): void {
  _currentUserId = id;
}

/**
 * Read the active user_id without throwing. Use this in code paths that
 * legitimately run pre-auth (database init, the reference-only peptides
 * table seed) or in callers that need to branch on signed-in vs not.
 */
export function getCurrentUserId(): string | null {
  return _currentUserId;
}

/**
 * Read the active user_id; throw if no user is set. Use this in every
 * user-owned query. The throw is deliberate: it surfaces "missing scope"
 * bugs at the query site instead of letting a missing WHERE clause
 * silently leak data between accounts.
 *
 * The throw is dormant today because the underlying queries don't yet
 * filter by user_id; the Phase C commit turns this into a real
 * enforcement mechanism.
 */
export function requireUserId(): string {
  if (!_currentUserId) {
    throw new Error(
      'No active user — call setCurrentUserId() before this query, ' +
        'or move the query inside an auth-gated screen.',
    );
  }
  return _currentUserId;
}

// ---- v1.1 migration helper -----------------------------------------------
// Adds a column only if it doesn't already exist. Safe across fresh installs
// and upgrades because PRAGMA table_info tells us what's there.
async function addColumnIfMissing(
  d: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  const cols = await d.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!cols.some((c) => c.name === column)) {
    await d.runAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export async function initDatabase() {
  const d = db();
  await d.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      local_user_id TEXT NOT NULL,
      display_name TEXT,
      birth_year INTEGER,
      unit_weight TEXT NOT NULL DEFAULT 'lb',
      unit_volume TEXT NOT NULL DEFAULT 'units',
      theme TEXT NOT NULL DEFAULT 'system',
      terms_version TEXT,
      terms_accepted_at TEXT,
      age_gate_accepted_at TEXT,
      disclaimer_accepted_at TEXT,
      onboarding_done INTEGER NOT NULL DEFAULT 0,
      notifications_enabled INTEGER NOT NULL DEFAULT 1,
      biometric_lock INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS peptides (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subtitle TEXT,
      class TEXT,
      color TEXT,
      formula TEXT,
      mw TEXT,
      half_life TEXT,
      route TEXT,
      dose TEXT,
      freq TEXT,
      sequence TEXT,
      summary TEXT,
      mechanism TEXT,
      reconstitution TEXT,
      notes TEXT,
      stacks_json TEXT,
      citations_json TEXT
    );

    CREATE TABLE IF NOT EXISTS saved_peptides (
      peptide_id TEXT PRIMARY KEY REFERENCES peptides(id),
      saved_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vials (
      id TEXT PRIMARY KEY,
      peptide_id TEXT NOT NULL REFERENCES peptides(id),
      strength_mg REAL NOT NULL,
      bac_water_ml REAL NOT NULL,
      concentration REAL NOT NULL,
      remaining_mg REAL NOT NULL,
      reconstituted_at TEXT NOT NULL,
      expires_at TEXT,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cycles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      starts_on TEXT NOT NULL,
      ends_on TEXT NOT NULL,
      phase TEXT NOT NULL DEFAULT 'active',
      status TEXT NOT NULL DEFAULT 'active',
      stack_id TEXT,
      protocol_json TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stacks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      goal TEXT,
      items_json TEXT NOT NULL DEFAULT '[]',
      synergy_score INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS doses (
      id TEXT PRIMARY KEY,
      peptide_id TEXT NOT NULL REFERENCES peptides(id),
      vial_id TEXT REFERENCES vials(id),
      cycle_id TEXT REFERENCES cycles(id),
      amount_mcg REAL NOT NULL,
      volume_units REAL,
      route TEXT NOT NULL DEFAULT 'SubQ',
      site TEXT,
      taken_at TEXT NOT NULL,
      note TEXT,
      is_scheduled INTEGER NOT NULL DEFAULT 0,
      marked_missed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      entry_date TEXT NOT NULL UNIQUE,
      mood INTEGER,
      energy INTEGER,
      sleep_hours REAL,
      sleep_quality INTEGER,
      libido INTEGER,
      recovery INTEGER,
      tags_json TEXT NOT NULL DEFAULT '[]',
      body TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS metrics (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT,
      taken_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS injection_sites_log (
      id TEXT PRIMARY KEY,
      site TEXT NOT NULL,
      used_at TEXT NOT NULL,
      dose_id TEXT REFERENCES doses(id)
    );

    CREATE INDEX IF NOT EXISTS idx_doses_taken_at ON doses(taken_at DESC);
    CREATE INDEX IF NOT EXISTS idx_metrics_kind_taken ON metrics(kind, taken_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sites_used ON injection_sites_log(site, used_at DESC);
    CREATE INDEX IF NOT EXISTS idx_vials_active ON vials(peptide_id, is_active, reconstituted_at DESC);

    -- v1.1: dose_skips table (opt out of a scheduled dose with reason)
    CREATE TABLE IF NOT EXISTS dose_skips (
      id TEXT PRIMARY KEY,
      peptide_id TEXT NOT NULL,
      cycle_id TEXT,
      scheduled_date TEXT NOT NULL,
      time_of_day TEXT,
      reason TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_dose_skips_date ON dose_skips(scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_dose_skips_cycle ON dose_skips(cycle_id);
  `);

  // ---- v1.1 additive column migrations ------------------------------------
  // Run after the CREATE IF NOT EXISTS pass so tables definitely exist.
  // Each addColumnIfMissing is idempotent: safe on fresh installs and on
  // upgrades from earlier Helix versions.
  await addColumnIfMissing(d, 'vials', 'cost_usd', 'REAL');
  await addColumnIfMissing(d, 'vials', 'depleted_at', 'TEXT');
  await addColumnIfMissing(d, 'vials', 'first_used_at', 'TEXT');
  await addColumnIfMissing(d, 'vials', 'total_doses_drawn', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing(d, 'cycles', 'paused_at', 'TEXT');
  await addColumnIfMissing(d, 'cycles', 'paused_total_days', 'INTEGER NOT NULL DEFAULT 0');
  // v1.1 Phase 6: notification preferences (JSON blob on profile).
  await addColumnIfMissing(d, 'profile', 'notif_prefs_json', 'TEXT');
  // v1.2: vial-cycle attachment. Nullable single-owner FK back to cycles.
  // When a cycle completes the column is NULLed back to free inventory
  // so the next cycle can claim the same vial.
  await addColumnIfMissing(d, 'vials', 'cycle_id', 'TEXT');
  // v1.3: dismissed in-app banner keys (JSON string array). Generic so
  // future banners just add new keys without new columns.
  await addColumnIfMissing(d, 'profile', 'dismissed_banners', "TEXT NOT NULL DEFAULT '[]'");
  // v1.3: global dose-display preference. 'auto' uses mg when mcg ≥ 1000,
  // otherwise mcg. 'mcg' / 'mg' force a single unit everywhere. Storage
  // is always mcg in dose_mcg / amount_mcg — this is purely a display flag.
  await addColumnIfMissing(d, 'profile', 'dose_unit_pref', "TEXT NOT NULL DEFAULT 'auto'");

  // v1.4 — auth scoping. Every user-owned table gains a nullable user_id
  // column populated from requireUserId() on writes and filtered via
  // WHERE user_id = ? on reads. NULL on existing rows means "pre-auth
  // legacy data" — handled by the Phase C attribution prompt
  // (lib/db.ts:attributeLocalDataToUser).
  for (const t of [
    'saved_peptides', 'vials', 'cycles', 'stacks', 'doses',
    'journal_entries', 'metrics', 'injection_sites_log', 'dose_skips',
  ]) {
    await addColumnIfMissing(d, t, 'user_id', 'TEXT');
  }
  // One-time data-attribution flag — set when the user accepts the
  // "Keep your data?" prompt OR explicitly wipes. Prevents the prompt
  // from re-firing on subsequent launches.
  await addColumnIfMissing(d, 'profile', 'local_data_attributed_at', 'TEXT');

  // v1.5 — cross-device sync metadata. Every user-data table gets an
  // updated_at TEXT column populated in ISO-Z format (matches Supabase
  // timestamptz when serialized), plus an AFTER UPDATE trigger that
  // bumps it on every row change (unless the statement explicitly set
  // updated_at, which the sync pull does — guard via OLD.updated_at IS
  // NEW.updated_at to avoid recursive firing).
  //
  // We DO NOT touch read paths or write paths in this file — the
  // updated_at column is read+written only by lib/sync.ts. Stamping
  // it on INSERT is handled by the column DEFAULT; on UPDATE by the
  // trigger. Schema-level so every existing write function "just
  // works" without per-function patching.
  const SYNC_TABLES = [
    'profile', 'saved_peptides', 'vials', 'cycles', 'stacks',
    'doses', 'journal_entries', 'metrics', 'injection_sites_log', 'dose_skips',
  ];
  for (const t of SYNC_TABLES) {
    await addColumnIfMissing(
      d, t, 'updated_at',
      "TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
    );
    // Backfill existing rows where updated_at is still NULL (rows
    // created before this migration ran on the device). Use a stable
    // anchor: the table's created_at / saved_at where present, else
    // a row-specific old timestamp so they don't all collide on now()
    // and trigger a spurious sync push.
    const anchorCol =
      t === 'saved_peptides' ? 'saved_at' :
      t === 'profile' ? null : 'created_at';
    if (anchorCol) {
      await d.runAsync(
        `UPDATE ${t} SET updated_at = ${anchorCol}
           WHERE updated_at IS NULL AND ${anchorCol} IS NOT NULL`,
      );
    }
    await d.runAsync(
      `UPDATE ${t} SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE updated_at IS NULL`,
    );
    // AFTER UPDATE trigger — bumps updated_at unless the statement
    // already wrote a fresh one (sync pull case). The WHEN guard
    // prevents recursive firing because our inner UPDATE writes a
    // new value, breaking the OLD IS NEW condition the second time.
    const pkCol = t === 'saved_peptides' ? 'peptide_id' : 'id';
    await d.execAsync(
      `CREATE TRIGGER IF NOT EXISTS ${t}_touch_updated_at
         AFTER UPDATE ON ${t}
         FOR EACH ROW
         WHEN OLD.updated_at IS NEW.updated_at
         BEGIN
           UPDATE ${t} SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE ${pkCol} = NEW.${pkCol};
         END`,
    );
  }

  // Seed peptides on first run (upsert on id so updates flow through).
  for (const p of PEPTIDES) {
    await d.runAsync(
      `INSERT OR REPLACE INTO peptides
         (id, name, subtitle, class, color, formula, mw, half_life, route, dose, freq,
          sequence, summary, mechanism, reconstitution, notes, stacks_json, citations_json)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      p.id, p.name, p.subtitle, p.class, p.color, p.formula, p.mw, p.halfLife, p.route,
      p.dose, p.freq, p.sequence, p.summary, p.mechanism, p.reconstitution, p.notes,
      JSON.stringify(p.stacks), JSON.stringify(p.citations)
    );
  }

  // Ensure a single profile row exists with a local_user_id
  const prof = await d.getFirstAsync<{ id: number }>('SELECT id FROM profile WHERE id = 1');
  if (!prof) {
    const uid = `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await d.runAsync(
      `INSERT INTO profile (id, local_user_id) VALUES (1, ?)`,
      uid
    );
  }
}

// ---- Profile ---------------------------------------------------------------

// Profile type lives in lib/db-types.ts (re-exported above).

export async function getProfile(): Promise<Profile | null> {
  return db().getFirstAsync<Profile>('SELECT * FROM profile WHERE id = 1');
}

export async function updateProfile(patch: Partial<Profile>) {
  const entries = Object.entries(patch);
  if (entries.length === 0) return;
  const set = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => v as string | number | null);
  await db().runAsync(`UPDATE profile SET ${set} WHERE id = 1`, ...values);
}

export function parseDismissedBanners(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

export async function dismissBanner(key: string): Promise<void> {
  const prof = await getProfile();
  const current = parseDismissedBanners(prof?.dismissed_banners);
  if (current.includes(key)) return;
  current.push(key);
  await updateProfile({ dismissed_banners: JSON.stringify(current) });
}

// ---- Saved peptides --------------------------------------------------------
// PK on saved_peptides is still peptide_id (not composite), which means
// two users on the same device can't independently save overlapping
// peptides without one shadowing the other. Single-user-per-device is
// the operating assumption; the data attribution prompt forces users
// to choose at sign-in time.

export async function isSaved(peptide_id: string): Promise<boolean> {
  const uid = requireUserId();
  const row = await db().getFirstAsync<{ peptide_id: string }>(
    'SELECT peptide_id FROM saved_peptides WHERE peptide_id = ? AND user_id = ?',
    peptide_id, uid
  );
  return !!row;
}

export async function savePeptide(peptide_id: string) {
  const uid = requireUserId();
  await db().runAsync(
    'INSERT OR REPLACE INTO saved_peptides (peptide_id, user_id) VALUES (?, ?)',
    peptide_id, uid
  );
}

export async function unsavePeptide(peptide_id: string) {
  const uid = requireUserId();
  await db().runAsync(
    'DELETE FROM saved_peptides WHERE peptide_id = ? AND user_id = ?',
    peptide_id, uid
  );
}

export async function listSavedPeptides(): Promise<string[]> {
  const uid = requireUserId();
  const rows = await db().getAllAsync<{ peptide_id: string }>(
    'SELECT peptide_id FROM saved_peptides WHERE user_id = ? ORDER BY saved_at DESC',
    uid
  );
  return rows.map((r) => r.peptide_id);
}

// ---- Vials -----------------------------------------------------------------

// Vial and DoseSkip types live in lib/db-types.ts (re-exported above).

export async function createVial(input: {
  peptide_id: string;
  strength_mg: number;
  bac_water_ml: number;
  expires_in_days?: number;
  notes?: string;
}): Promise<string> {
  const uid = requireUserId();
  const id = genId('vial');
  const concentration = input.strength_mg / input.bac_water_ml;
  const now = new Date();
  const expires = new Date(now.getTime() + (input.expires_in_days ?? 30) * 864e5);
  // Deactivate any previous active vial for this peptide (within this user only).
  await db().runAsync(
    'UPDATE vials SET is_active = 0 WHERE peptide_id = ? AND is_active = 1 AND user_id = ?',
    input.peptide_id, uid
  );
  await db().runAsync(
    `INSERT INTO vials
      (id, user_id, peptide_id, strength_mg, bac_water_ml, concentration, remaining_mg,
       reconstituted_at, expires_at, notes, is_active)
     VALUES (?,?,?,?,?,?,?,?,?,?,1)`,
    id, uid, input.peptide_id, input.strength_mg, input.bac_water_ml, concentration,
    input.strength_mg, now.toISOString(), expires.toISOString(), input.notes ?? null
  );
  return id;
}

export async function getActiveVial(peptide_id: string): Promise<Vial | null> {
  const uid = requireUserId();
  return db().getFirstAsync<Vial>(
    `SELECT * FROM vials WHERE peptide_id = ? AND is_active = 1 AND user_id = ?
     ORDER BY reconstituted_at DESC LIMIT 1`,
    peptide_id, uid
  );
}

export async function listActiveVials(): Promise<Vial[]> {
  const uid = requireUserId();
  return db().getAllAsync<Vial>(
    `SELECT * FROM vials WHERE is_active = 1 AND user_id = ? ORDER BY reconstituted_at DESC`,
    uid
  );
}

export async function getVial(id: string): Promise<Vial | null> {
  const uid = requireUserId();
  return db().getFirstAsync<Vial>(
    'SELECT * FROM vials WHERE id = ? AND user_id = ?',
    id, uid
  );
}

export async function deactivateVial(id: string) {
  const uid = requireUserId();
  // v1.1: stamp depleted_at when is_active flips 1->0, iff not already set.
  await db().runAsync(
    `UPDATE vials
        SET is_active = 0,
            depleted_at = COALESCE(depleted_at, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE id = ? AND user_id = ?`,
    id, uid
  );
}

export async function deleteVial(id: string) {
  const uid = requireUserId();
  // Clear the vial_id foreign key on any doses that referenced it,
  // then delete the vial row.
  const d = db();
  await d.withTransactionAsync(async () => {
    await d.runAsync(
      'UPDATE doses SET vial_id = NULL WHERE vial_id = ? AND user_id = ?',
      id, uid
    );
    await d.runAsync('DELETE FROM vials WHERE id = ? AND user_id = ?', id, uid);
  });
}

// v1.1: restore a depleted vial back to active. Clears depleted_at.
export async function restoreVial(id: string) {
  const uid = requireUserId();
  await db().runAsync(
    'UPDATE vials SET is_active = 1, depleted_at = NULL WHERE id = ? AND user_id = ?',
    id, uid
  );
}

// v1.1: vial history (is_active=0) newest first, with optional filter.
export async function getVialHistory(opts: { limit?: number; peptideId?: string } = {}): Promise<Vial[]> {
  const uid = requireUserId();
  const { limit = 100, peptideId } = opts;
  if (peptideId) {
    return db().getAllAsync<Vial>(
      `SELECT * FROM vials WHERE is_active = 0 AND peptide_id = ? AND user_id = ?
       ORDER BY depleted_at DESC, reconstituted_at DESC LIMIT ?`,
      peptideId, uid, limit
    );
  }
  return db().getAllAsync<Vial>(
    `SELECT * FROM vials WHERE is_active = 0 AND user_id = ?
     ORDER BY depleted_at DESC, reconstituted_at DESC LIMIT ?`,
    uid, limit
  );
}

// v1.1: all vials for a peptide (active-only flag optional).
export async function getVialsForPeptide(peptideId: string, activeOnly = false): Promise<Vial[]> {
  const uid = requireUserId();
  if (activeOnly) {
    return db().getAllAsync<Vial>(
      `SELECT * FROM vials WHERE peptide_id = ? AND is_active = 1 AND user_id = ?
       ORDER BY reconstituted_at DESC`,
      peptideId, uid
    );
  }
  return db().getAllAsync<Vial>(
    `SELECT * FROM vials WHERE peptide_id = ? AND user_id = ?
     ORDER BY is_active DESC, reconstituted_at DESC`,
    peptideId, uid
  );
}

// v1.1: alias matching the spec name.
export const getVialById = getVial;

// ---- v1.2: vial-cycle attachment ------------------------------------------
//
// Single-owner: a vial can be attached to AT MOST one cycle. The DB doesn't
// enforce this — the application layer does, by overwriting cycle_id on
// attach (so 'move from old cycle to new cycle' is a single UPDATE rather
// than a two-step detach + attach).
//
// When a cycle ends (status flips to 'complete' or 'cancelled'), every
// attached vial's cycle_id is NULLed back to free inventory. The dose
// history retains the cycle linkage on each individual dose row, so cycle
// detail can still reconstruct "which vials were used during this cycle"
// via a join through doses.

// Vials whose peptide_id appears in this cycle's protocol AND that are
// either currently active OR depleted within the last 30 days. Past 30d
// vials are clutter — users have moved on.
//
// Sorted active-first, then most-recently reconstituted.
export async function matchingVialsForCycle(
  cycle: Pick<Cycle, 'id' | 'protocol_json'>
): Promise<Vial[]> {
  const uid = requireUserId();
  let peptideIds: string[] = [];
  try {
    const protocol = JSON.parse(cycle.protocol_json || '[]') as { peptide_id: string }[];
    peptideIds = Array.from(new Set(protocol.map((p) => p.peptide_id).filter(Boolean)));
  } catch {
    return [];
  }
  if (peptideIds.length === 0) return [];
  const placeholders = peptideIds.map(() => '?').join(',');
  const cutoff = new Date(Date.now() - 30 * 864e5).toISOString();
  return db().getAllAsync<Vial>(
    `SELECT * FROM vials
       WHERE peptide_id IN (${placeholders})
         AND user_id = ?
         AND (is_active = 1 OR (depleted_at IS NOT NULL AND depleted_at >= ?))
       ORDER BY is_active DESC, reconstituted_at DESC`,
    ...peptideIds,
    uid,
    cutoff
  );
}

// Vials currently attached to this cycle. Used by cycle detail's "Vials"
// section.
export async function getVialsForCycle(cycle_id: string): Promise<Vial[]> {
  const uid = requireUserId();
  return db().getAllAsync<Vial>(
    `SELECT * FROM vials WHERE cycle_id = ? AND user_id = ? ORDER BY reconstituted_at DESC`,
    cycle_id, uid
  );
}

// Single-owner: writes cycle_id directly. If the vial was already attached
// to another cycle, that link is overwritten. The UI should prompt before
// reaching this function in that case so the user understands the move.
export async function attachVialToCycle(vial_id: string, cycle_id: string) {
  const uid = requireUserId();
  await db().runAsync(
    'UPDATE vials SET cycle_id = ? WHERE id = ? AND user_id = ?',
    cycle_id, vial_id, uid
  );
}

// Returns vial back to free inventory. Doses logged from this vial keep
// their existing cycle_id — detaching the vial doesn't rewrite history.
export async function detachVial(vial_id: string) {
  const uid = requireUserId();
  await db().runAsync(
    'UPDATE vials SET cycle_id = NULL WHERE id = ? AND user_id = ?',
    vial_id, uid
  );
}

// Count of active vials of this peptide not attached to any cycle.
// log-dose uses this to decide whether vial→cycle linkage is
// unambiguous enough to do silently (exactly one such vial + exactly
// one covering cycle = no prompt).
export async function countUnattachedActiveVials(peptide_id: string): Promise<number> {
  const uid = requireUserId();
  const row = await db().getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM vials
       WHERE peptide_id = ? AND user_id = ?
         AND cycle_id IS NULL AND is_active = 1`,
    peptide_id, uid
  );
  return row?.n ?? 0;
}

// v1.1: all doses drawn from a specific vial (timeline on vial detail).
export async function getDosesForVial(vialId: string): Promise<Dose[]> {
  const uid = requireUserId();
  return db().getAllAsync<Dose>(
    'SELECT * FROM doses WHERE vial_id = ? AND user_id = ? ORDER BY taken_at DESC',
    vialId, uid
  );
}

// v1.1: update a vial's static fields. When strength_mg or bac_water_ml
// changes, remaining_mg and concentration are recomputed from the dose
// history (strength_mg − sum of amount_mcg / 1000 drawn from this vial).
// Dose history is preserved. Wrapped in a transaction.
export async function updateVial(
  id: string,
  patch: {
    strength_mg?: number;
    bac_water_ml?: number;
    expires_at?: string | null;
    notes?: string | null;
    cost_usd?: number | null;
  }
) {
  const uid = requireUserId();
  const d = db();
  await d.withTransactionAsync(async () => {
    const current = await d.getFirstAsync<Vial>(
      'SELECT * FROM vials WHERE id = ? AND user_id = ?',
      id, uid
    );
    if (!current) return;

    const newStrength = patch.strength_mg ?? current.strength_mg;
    const newBac = patch.bac_water_ml ?? current.bac_water_ml;
    const recomputeConc = newStrength !== current.strength_mg || newBac !== current.bac_water_ml;
    const newConc = newStrength / newBac;

    let newRemaining = current.remaining_mg;
    if (patch.strength_mg !== undefined && patch.strength_mg !== current.strength_mg) {
      const sum = await d.getFirstAsync<{ drawn_mg: number | null }>(
        'SELECT COALESCE(SUM(amount_mcg), 0) / 1000.0 AS drawn_mg FROM doses WHERE vial_id = ? AND user_id = ?',
        id, uid
      );
      const drawn = sum?.drawn_mg ?? 0;
      newRemaining = Math.max(0, newStrength - drawn);
    }

    const sets: string[] = [];
    const vals: (string | number | null)[] = [];
    sets.push('strength_mg = ?'); vals.push(newStrength);
    sets.push('bac_water_ml = ?'); vals.push(newBac);
    if (recomputeConc) { sets.push('concentration = ?'); vals.push(newConc); }
    sets.push('remaining_mg = ?'); vals.push(newRemaining);
    if (patch.expires_at !== undefined) { sets.push('expires_at = ?'); vals.push(patch.expires_at); }
    if (patch.notes !== undefined) { sets.push('notes = ?'); vals.push(patch.notes); }
    if (patch.cost_usd !== undefined) { sets.push('cost_usd = ?'); vals.push(patch.cost_usd); }
    vals.push(id, uid);
    await d.runAsync(`UPDATE vials SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, ...vals);
  });
}

export async function getDoseById(id: string): Promise<Dose | null> {
  const uid = requireUserId();
  return db().getFirstAsync<Dose>(
    'SELECT * FROM doses WHERE id = ? AND user_id = ?',
    id, uid
  );
}

export async function updateDose(
  id: string,
  patch: {
    amount_mcg?: number;
    route?: string;
    site?: string | null;
    note?: string | null;
    taken_at?: string;
  }
) {
  const uid = requireUserId();
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  if (patch.amount_mcg !== undefined) { sets.push('amount_mcg = ?'); values.push(patch.amount_mcg); }
  if (patch.route !== undefined) { sets.push('route = ?'); values.push(patch.route); }
  if (patch.site !== undefined) { sets.push('site = ?'); values.push(patch.site); }
  if (patch.note !== undefined) { sets.push('note = ?'); values.push(patch.note); }
  if (patch.taken_at !== undefined) { sets.push('taken_at = ?'); values.push(patch.taken_at); }
  if (sets.length === 0) return;

  const d = db();
  await d.withTransactionAsync(async () => {
    const current = await d.getFirstAsync<Dose>(
      'SELECT * FROM doses WHERE id = ? AND user_id = ?',
      id, uid
    );
    if (!current) return;

    const params = [...values, id, uid];
    await d.runAsync(
      `UPDATE doses SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
      ...params
    );

    if (patch.amount_mcg !== undefined && current.vial_id) {
      const deltaMg = (patch.amount_mcg - current.amount_mcg) / 1000;
      await d.runAsync(
        'UPDATE vials SET remaining_mg = MAX(0, remaining_mg - ?) WHERE id = ? AND user_id = ?',
        deltaMg,
        current.vial_id,
        uid
      );
    }

    if (patch.site !== undefined || patch.taken_at !== undefined) {
      await d.runAsync(
        'DELETE FROM injection_sites_log WHERE dose_id = ? AND user_id = ?',
        id, uid
      );
      if (patch.site) {
        const dose = await d.getFirstAsync<{ taken_at: string }>(
          'SELECT taken_at FROM doses WHERE id = ? AND user_id = ?',
          id, uid
        );
        if (dose) {
          const sid = `site_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
          await d.runAsync(
            'INSERT INTO injection_sites_log (id, user_id, site, used_at, dose_id) VALUES (?,?,?,?,?)',
            sid, uid, patch.site, dose.taken_at, id
          );
        }
      }
    }
  });
}

// ---- Doses -----------------------------------------------------------------

// Dose type lives in lib/db-types.ts (re-exported above).

export async function logDose(input: {
  peptide_id: string;
  vial_id?: string | null;
  cycle_id?: string | null;
  amount_mcg: number;
  volume_units?: number | null;
  route: string;
  site?: string | null;
  taken_at?: string;
  note?: string;
}): Promise<string> {
  const uid = requireUserId();
  const id = genId('dose');
  const taken_at = input.taken_at ?? new Date().toISOString();
  const amount_mg = input.amount_mcg / 1000;
  const d = db();

  // v1.1: if vial_id omitted, auto-pick the active vial for this peptide
  // that's closest to expiry (so we drain soon-to-expire vials first).
  let vial_id: string | null = input.vial_id ?? null;
  if (vial_id === null) {
    const auto = await d.getFirstAsync<{ id: string }>(
      `SELECT id FROM vials
        WHERE peptide_id = ? AND is_active = 1 AND user_id = ?
        ORDER BY (expires_at IS NULL) ASC, expires_at ASC, reconstituted_at ASC
        LIMIT 1`,
      input.peptide_id, uid
    );
    if (auto) vial_id = auto.id;
  }

  // v1.1: if cycle_id omitted, auto-attach to the active cycle whose
  // protocol covers this peptide. Eliminates the 'orphan dose' surprise
  // on dose-history when a user logs mid-cycle without explicitly
  // selecting the cycle every time.
  let cycle_id: string | null = input.cycle_id ?? null;
  if (cycle_id === null) {
    const cov = await getActiveCycleForPeptide(input.peptide_id);
    if (cov) cycle_id = cov.id;
  }

  await d.withTransactionAsync(async () => {
    await d.runAsync(
      `INSERT INTO doses (id, user_id, peptide_id, vial_id, cycle_id, amount_mcg, volume_units,
                          route, site, taken_at, note)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      id, uid, input.peptide_id, vial_id, cycle_id,
      input.amount_mcg, input.volume_units ?? null, input.route,
      input.site ?? null, taken_at, input.note ?? null
    );
    if (vial_id) {
      // v1.1: also bump total_doses_drawn and set first_used_at if null.
      await d.runAsync(
        `UPDATE vials
           SET remaining_mg      = MAX(0, remaining_mg - ?),
               total_doses_drawn = total_doses_drawn + 1,
               first_used_at     = COALESCE(first_used_at, ?)
         WHERE id = ? AND user_id = ?`,
        amount_mg, taken_at, vial_id, uid
      );
    }
    if (input.site) {
      const sid = genId('site');
      await d.runAsync(
        `INSERT INTO injection_sites_log (id, user_id, site, used_at, dose_id) VALUES (?,?,?,?,?)`,
        sid, uid, input.site, taken_at, id
      );
    }
  });
  return id;
}

export async function listDoses(opts: { limit?: number; from?: string; to?: string } = {}): Promise<Dose[]> {
  const uid = requireUserId();
  const { limit = 50, from, to } = opts;
  const args: unknown[] = [uid];
  const where: string[] = ['user_id = ?'];
  if (from) { where.push('taken_at >= ?'); args.push(from); }
  if (to) { where.push('taken_at <= ?'); args.push(to); }
  const sql = `SELECT * FROM doses WHERE ${where.join(' AND ')} ORDER BY taken_at DESC LIMIT ?`;
  args.push(limit);
  return db().getAllAsync<Dose>(sql, ...args as (string | number)[]);
}

export async function getLastDoseForCyclePeptide(
  cycle_id: string,
  peptide_id: string
): Promise<Dose | null> {
  const uid = requireUserId();
  return db().getFirstAsync<Dose>(
    `SELECT * FROM doses
      WHERE cycle_id = ? AND peptide_id = ? AND user_id = ?
      ORDER BY taken_at DESC LIMIT 1`,
    cycle_id,
    peptide_id,
    uid
  );
}

export async function deleteDose(id: string) {
  const uid = requireUserId();
  const dose = await db().getFirstAsync<Dose>(
    'SELECT * FROM doses WHERE id = ? AND user_id = ?',
    id, uid
  );
  if (!dose) return;
  const d = db();
  await d.withTransactionAsync(async () => {
    if (dose.vial_id) {
      await d.runAsync(
        'UPDATE vials SET remaining_mg = remaining_mg + ? WHERE id = ? AND user_id = ?',
        dose.amount_mcg / 1000, dose.vial_id, uid
      );
    }
    await d.runAsync(
      'DELETE FROM injection_sites_log WHERE dose_id = ? AND user_id = ?',
      id, uid
    );
    await d.runAsync('DELETE FROM doses WHERE id = ? AND user_id = ?', id, uid);
  });
}

// ---- Cycles ----------------------------------------------------------------

// Cycle, CycleProtocolItemPhase, CycleProtocolItem types live in
// lib/db-types.ts (re-exported above).

export async function createCycle(input: {
  name: string;
  starts_on: string;
  ends_on: string;
  phase?: Cycle['phase'];
  stack_id?: string | null;
  protocol: CycleProtocolItem[];
  notes?: string;
}): Promise<string> {
  const uid = requireUserId();
  const id = genId('cycle');
  await db().runAsync(
    `INSERT INTO cycles (id, user_id, name, starts_on, ends_on, phase, status, stack_id, protocol_json, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    id, uid, input.name, input.starts_on, input.ends_on,
    input.phase ?? 'active', 'active', input.stack_id ?? null,
    JSON.stringify(input.protocol), input.notes ?? null
  );
  return id;
}

export async function getActiveCycle(): Promise<Cycle | null> {
  const uid = requireUserId();
  return db().getFirstAsync<Cycle>(
    `SELECT * FROM cycles WHERE status = 'active' AND user_id = ? ORDER BY starts_on DESC LIMIT 1`,
    uid
  );
}

// v1.1: list ALL currently-active cycles. Multiple concurrent cycles are
// a first-class case (e.g. running a healing protocol alongside a fat-loss
// one with different durations). Today / Stacks / notifications all merge
// the protocols across the result; getActiveCycle stays for callers that
// genuinely need a single representative cycle.
export async function listActiveCycles(): Promise<Cycle[]> {
  const uid = requireUserId();
  return db().getAllAsync<Cycle>(
    `SELECT * FROM cycles WHERE status IN ('active', 'paused') AND user_id = ? ORDER BY starts_on DESC`,
    uid
  );
}

// v1.1: all active cycles whose protocol includes this peptide, most
// recently started first (listActiveCycles orders by starts_on DESC).
// 'paused' cycles are excluded — only genuinely running cycles cover a
// peptide for dose/vial-attachment purposes.
export async function listActiveCyclesForPeptide(peptideId: string): Promise<Cycle[]> {
  const all = await listActiveCycles();
  const out: Cycle[] = [];
  for (const c of all) {
    if (c.status !== 'active') continue;
    try {
      const protocol = JSON.parse(c.protocol_json || '[]') as { peptide_id: string }[];
      if (protocol.some((row) => row.peptide_id === peptideId)) out.push(c);
    } catch {
      // Malformed protocol_json — skip; don't crash the lookup.
    }
  }
  return out;
}

// v1.1: most recently started active cycle covering this peptide, or
// null. Used by logDose to auto-attach a dose's cycle_id so doses stop
// accumulating as 'orphan' when a covering cycle is running. When more
// than one active cycle covers the same peptide, returns the most
// recently started one — the user's clearest intent.
export async function getActiveCycleForPeptide(peptideId: string): Promise<Cycle | null> {
  return (await listActiveCyclesForPeptide(peptideId))[0] ?? null;
}

export async function listCycles(): Promise<Cycle[]> {
  const uid = requireUserId();
  return db().getAllAsync<Cycle>(
    'SELECT * FROM cycles WHERE user_id = ? ORDER BY starts_on DESC',
    uid
  );
}

export async function endCycle(id: string) {
  const uid = requireUserId();
  const d = db();
  await d.withTransactionAsync(async () => {
    await d.runAsync(
      `UPDATE cycles SET status = 'complete' WHERE id = ? AND user_id = ?`,
      id, uid
    );
    // v1.2: when a cycle ends, attached vials return to free inventory so
    // a follow-up cycle can claim them. Doses keep their per-row cycle_id
    // so the historical accounting stays intact.
    await d.runAsync(
      `UPDATE vials SET cycle_id = NULL WHERE cycle_id = ? AND user_id = ?`,
      id, uid
    );
  });
}

// v1.1: pause an active cycle. Today stops scheduling from it until resumed.
export async function pauseCycle(id: string) {
  const uid = requireUserId();
  await db().runAsync(
    `UPDATE cycles
        SET status = 'paused',
            paused_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ? AND user_id = ?`,
    id, uid
  );
}

// v1.1: resume a paused cycle. Shifts ends_on forward by the paused span
// and accumulates paused_total_days. Clears paused_at.
export async function resumeCycle(id: string) {
  const uid = requireUserId();
  const d = db();
  await d.withTransactionAsync(async () => {
    const row = await d.getFirstAsync<Cycle>(
      'SELECT * FROM cycles WHERE id = ? AND user_id = ?',
      id, uid
    );
    if (!row || !row.paused_at) return;
    const pausedMs = Date.now() - new Date(row.paused_at).getTime();
    const pausedDays = Math.max(0, Math.round(pausedMs / 864e5));
    const endsOn = new Date(row.ends_on);
    endsOn.setDate(endsOn.getDate() + pausedDays);
    const newEnds = endsOn.toISOString().slice(0, 10);
    await d.runAsync(
      `UPDATE cycles
          SET status = 'active',
              paused_at = NULL,
              paused_total_days = paused_total_days + ?,
              ends_on = ?
        WHERE id = ? AND user_id = ?`,
      pausedDays, newEnds, id, uid
    );
  });
}

// v1.1: dose skip helpers.
export async function createDoseSkip(input: {
  peptide_id: string;
  cycle_id?: string | null;
  scheduled_date: string;
  time_of_day?: string | null;
  reason?: string | null;
  note?: string | null;
}): Promise<string> {
  const uid = requireUserId();
  const id = genId('skip');
  await db().runAsync(
    `INSERT INTO dose_skips
       (id, user_id, peptide_id, cycle_id, scheduled_date, time_of_day, reason, note, created_at)
     VALUES (?,?,?,?,?,?,?,?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
    id,
    uid,
    input.peptide_id,
    input.cycle_id ?? null,
    input.scheduled_date,
    input.time_of_day ?? null,
    input.reason ?? null,
    input.note ?? null
  );
  return id;
}

export async function listDoseSkips(
  opts: { from?: string; to?: string; cycle_id?: string } = {}
): Promise<DoseSkip[]> {
  const uid = requireUserId();
  const where: string[] = ['user_id = ?'];
  const args: (string | number)[] = [uid];
  if (opts.from) { where.push('scheduled_date >= ?'); args.push(opts.from); }
  if (opts.to) { where.push('scheduled_date <= ?'); args.push(opts.to); }
  if (opts.cycle_id) { where.push('cycle_id = ?'); args.push(opts.cycle_id); }
  const sql = `SELECT * FROM dose_skips WHERE ${where.join(' AND ')} ORDER BY scheduled_date DESC`;
  return db().getAllAsync<DoseSkip>(sql, ...args);
}

export async function deleteDoseSkip(id: string) {
  const uid = requireUserId();
  await db().runAsync('DELETE FROM dose_skips WHERE id = ? AND user_id = ?', id, uid);
}

export async function updateCycle(
  id: string,
  patch: {
    name?: string;
    starts_on?: string;
    ends_on?: string;
    phase?: Cycle['phase'];
    status?: Cycle['status'];
    protocol?: CycleProtocolItem[];
    notes?: string;
  }
) {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  if (patch.name !== undefined) { sets.push('name = ?'); values.push(patch.name); }
  if (patch.starts_on !== undefined) { sets.push('starts_on = ?'); values.push(patch.starts_on); }
  if (patch.ends_on !== undefined) { sets.push('ends_on = ?'); values.push(patch.ends_on); }
  if (patch.phase !== undefined) { sets.push('phase = ?'); values.push(patch.phase); }
  if (patch.status !== undefined) { sets.push('status = ?'); values.push(patch.status); }
  if (patch.protocol !== undefined) {
    sets.push('protocol_json = ?');
    values.push(JSON.stringify(patch.protocol));
  }
  if (patch.notes !== undefined) { sets.push('notes = ?'); values.push(patch.notes); }
  if (sets.length === 0) return;
  const uid = requireUserId();
  values.push(id, uid);
  await db().runAsync(
    `UPDATE cycles SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
    ...values
  );
}

// ---- Stacks ----------------------------------------------------------------

// StackItem and Stack types live in lib/db-types.ts (re-exported above).

export async function createStack(input: {
  name: string;
  goal?: string;
  items: StackItem[];
  synergy_score?: number;
}): Promise<string> {
  const uid = requireUserId();
  const id = genId('stack');
  await db().runAsync(
    `INSERT INTO stacks (id, user_id, name, goal, items_json, synergy_score)
     VALUES (?,?,?,?,?,?)`,
    id, uid, input.name, input.goal ?? null, JSON.stringify(input.items),
    input.synergy_score ?? null
  );
  return id;
}

export async function listStacks(): Promise<Stack[]> {
  const uid = requireUserId();
  return db().getAllAsync<Stack>(
    'SELECT * FROM stacks WHERE user_id = ? ORDER BY created_at DESC',
    uid
  );
}

export async function getStack(id: string): Promise<Stack | null> {
  const uid = requireUserId();
  return db().getFirstAsync<Stack>(
    'SELECT * FROM stacks WHERE id = ? AND user_id = ?',
    id, uid
  );
}

export async function deleteStack(id: string) {
  const uid = requireUserId();
  await db().runAsync('DELETE FROM stacks WHERE id = ? AND user_id = ?', id, uid);
}

// ---- Journal ---------------------------------------------------------------

// JournalEntry type lives in lib/db-types.ts (re-exported above).

export async function upsertJournal(input: {
  entry_date: string;
  mood?: number;
  energy?: number;
  sleep_hours?: number;
  sleep_quality?: number;
  libido?: number;
  recovery?: number;
  tags?: string[];
  body?: string;
}) {
  const uid = requireUserId();
  const existing = await db().getFirstAsync<JournalEntry>(
    'SELECT * FROM journal_entries WHERE entry_date = ? AND user_id = ?',
    input.entry_date, uid
  );
  if (existing) {
    await db().runAsync(
      `UPDATE journal_entries SET mood = ?, energy = ?, sleep_hours = ?, sleep_quality = ?,
         libido = ?, recovery = ?, tags_json = ?, body = ?, updated_at = datetime('now')
       WHERE entry_date = ? AND user_id = ?`,
      input.mood ?? existing.mood, input.energy ?? existing.energy,
      input.sleep_hours ?? existing.sleep_hours, input.sleep_quality ?? existing.sleep_quality,
      input.libido ?? existing.libido, input.recovery ?? existing.recovery,
      JSON.stringify(input.tags ?? JSON.parse(existing.tags_json)),
      input.body ?? existing.body, input.entry_date, uid
    );
    return existing.id;
  }
  const id = genId('jrnl');
  await db().runAsync(
    `INSERT INTO journal_entries
       (id, user_id, entry_date, mood, energy, sleep_hours, sleep_quality, libido, recovery, tags_json, body)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    id, uid, input.entry_date, input.mood ?? null, input.energy ?? null,
    input.sleep_hours ?? null, input.sleep_quality ?? null,
    input.libido ?? null, input.recovery ?? null,
    JSON.stringify(input.tags ?? []), input.body ?? null
  );
  return id;
}

export async function getJournal(entry_date: string): Promise<JournalEntry | null> {
  const uid = requireUserId();
  return db().getFirstAsync<JournalEntry>(
    'SELECT * FROM journal_entries WHERE entry_date = ? AND user_id = ?',
    entry_date, uid
  );
}

export async function listJournal(limit = 30): Promise<JournalEntry[]> {
  const uid = requireUserId();
  return db().getAllAsync<JournalEntry>(
    'SELECT * FROM journal_entries WHERE user_id = ? ORDER BY entry_date DESC LIMIT ?',
    uid, limit
  );
}

// ---- Metrics ---------------------------------------------------------------

// Metric type and METRIC_KINDS live in lib/db-types.ts (re-exported above).

export async function insertMetric(input: {
  kind: string;
  value: number;
  unit?: string;
  taken_at?: string;
  note?: string;
}): Promise<string> {
  const uid = requireUserId();
  const id = genId('metric');
  const kind_info = METRIC_KINDS.find((k) => k.id === input.kind);
  await db().runAsync(
    `INSERT INTO metrics (id, user_id, kind, value, unit, taken_at, source, note)
     VALUES (?,?,?,?,?,?,?,?)`,
    id, uid, input.kind, input.value,
    input.unit ?? kind_info?.unit ?? null,
    input.taken_at ?? new Date().toISOString(),
    'manual', input.note ?? null
  );
  return id;
}

export async function listMetrics(kind: string, limit = 90): Promise<Metric[]> {
  const uid = requireUserId();
  return db().getAllAsync<Metric>(
    'SELECT * FROM metrics WHERE kind = ? AND user_id = ? ORDER BY taken_at DESC LIMIT ?',
    kind, uid, limit
  );
}

export async function listAllMetricKindsWithLatest(): Promise<{ kind: string; latest: Metric | null }[]> {
  const uid = requireUserId();
  const out: { kind: string; latest: Metric | null }[] = [];
  for (const k of METRIC_KINDS) {
    const latest = await db().getFirstAsync<Metric>(
      'SELECT * FROM metrics WHERE kind = ? AND user_id = ? ORDER BY taken_at DESC LIMIT 1',
      k.id, uid
    );
    out.push({ kind: k.id, latest });
  }
  return out;
}

export async function deleteMetric(id: string) {
  const uid = requireUserId();
  await db().runAsync('DELETE FROM metrics WHERE id = ? AND user_id = ?', id, uid);
}

// ---- Injection-site rotation -----------------------------------------------

// INJECTION_SITES and SiteSuggestion type live in lib/db-types.ts
// (re-exported above).

export async function siteSuggestion(): Promise<SiteSuggestion> {
  const uid = requireUserId();
  const d = db();
  const now = Date.now();
  // Filter the history to the current user's injection-route doses only.
  // Older rows without a user_id (pre-auth legacy) fall through so the
  // attribution prompt has historical context until the user accepts.
  const history = await d.getAllAsync<{ site: string; last_used: string; uses: number }>(
    `SELECT s.site, MAX(s.used_at) AS last_used, COUNT(*) AS uses
       FROM injection_sites_log s
       LEFT JOIN doses d ON d.id = s.dose_id
      WHERE (s.user_id = ? OR s.user_id IS NULL)
        AND (d.route IS NULL OR d.route IN ('SubQ', 'IM'))
      GROUP BY s.site`,
    uid
  );
  const map = new Map(history.map((h) => [h.site, h]));
  const scored: SiteSuggestion[] = INJECTION_SITES.map((site) => {
    const h = map.get(site);
    const days_since = h
      ? Math.floor((now - new Date(h.last_used).getTime()) / 864e5)
      : 999;
    return {
      site,
      days_since,
      total_uses: h?.uses ?? 0,
      last_used: h?.last_used ?? null,
    };
  });
  scored.sort((a, b) => b.days_since - a.days_since || a.total_uses - b.total_uses);
  return scored[0];
}

export async function siteRecency(): Promise<SiteSuggestion[]> {
  const uid = requireUserId();
  const now = Date.now();
  // Same injection-route + user_id filter as siteSuggestion — see there.
  const history = await db().getAllAsync<{ site: string; last_used: string; uses: number }>(
    `SELECT s.site, MAX(s.used_at) AS last_used, COUNT(*) AS uses
       FROM injection_sites_log s
       LEFT JOIN doses d ON d.id = s.dose_id
      WHERE (s.user_id = ? OR s.user_id IS NULL)
        AND (d.route IS NULL OR d.route IN ('SubQ', 'IM'))
      GROUP BY s.site`,
    uid
  );
  const map = new Map(history.map((h) => [h.site, h]));
  return INJECTION_SITES.map((site) => {
    const h = map.get(site);
    return {
      site,
      days_since: h ? Math.floor((now - new Date(h.last_used).getTime()) / 864e5) : 999,
      total_uses: h?.uses ?? 0,
      last_used: h?.last_used ?? null,
    };
  });
}

// v1.1: most recent doses logged AT a given site, joined back to the
// doses table so the site-detail sheet can show peptide / amount /
// timestamp without an extra round-trip per row. Limit defaults to 10
// — the bottom sheet has no virtualization so we don't want to hand it
// 500 rows.
export async function listDosesAtSite(site: string, limit = 10): Promise<Dose[]> {
  const uid = requireUserId();
  // Filter to injection routes + the current user. NULL route / user_id
  // fall through for backward-compat with pre-route-tracking / pre-auth
  // rows (legacy data attribution rewrites them once the user accepts
  // the post-signup prompt).
  return db().getAllAsync<Dose>(
    `SELECT d.* FROM doses d
       INNER JOIN injection_sites_log s ON s.dose_id = d.id
      WHERE s.site = ?
        AND (d.user_id = ? OR d.user_id IS NULL)
        AND (d.route IS NULL OR d.route IN ('SubQ', 'IM'))
      ORDER BY d.taken_at DESC
      LIMIT ?`,
    site,
    uid,
    limit
  );
}

// ---- Export ----------------------------------------------------------------

// SCHEMA_VERSION lives in lib/db-types.ts (re-exported above).

export async function exportAllData(): Promise<{
  profile: unknown;
  cycles: Cycle[];
  doses: Dose[];
  vials: Vial[];
  stacks: Stack[];
  metrics: Metric[];
  journal: JournalEntry[];
  dose_skips: DoseSkip[];
  saved_peptides: string[];
  exported_at: string;
  schema_version: number;
}> {
  const uid = requireUserId();
  const d = db();
  return {
    profile: await getProfile(),
    cycles: await listCycles(),
    doses: await d.getAllAsync<Dose>(
      'SELECT * FROM doses WHERE user_id = ? ORDER BY taken_at DESC', uid
    ),
    vials: await d.getAllAsync<Vial>(
      'SELECT * FROM vials WHERE user_id = ? ORDER BY reconstituted_at DESC', uid
    ),
    stacks: await listStacks(),
    metrics: await d.getAllAsync<Metric>(
      'SELECT * FROM metrics WHERE user_id = ? ORDER BY taken_at DESC', uid
    ),
    journal: await listJournal(1000),
    dose_skips: await d.getAllAsync<DoseSkip>(
      'SELECT * FROM dose_skips WHERE user_id = ? ORDER BY scheduled_date DESC', uid
    ),
    saved_peptides: await listSavedPeptides(),
    exported_at: new Date().toISOString(),
    schema_version: SCHEMA_VERSION,
  };
}

export const exportAll = exportAllData;

// Wipes every user-data row. Pre-auth (legacy local-only) builds wipe
// the whole DB; auth-mode builds wipe only the current user's rows so
// other accounts on the same device aren't touched. The peptides
// reference table is untouched in both cases.
export async function deleteAllUserData() {
  const d = db();
  const uid = getCurrentUserId();
  await d.withTransactionAsync(async () => {
    if (uid) {
      // Auth mode — scoped wipe. Pre-auth NULL-user_id rows are also
      // cleared so accepting "Delete account" leaves no residue.
      const where = '(user_id = ? OR user_id IS NULL)';
      await d.runAsync(`DELETE FROM doses WHERE ${where}`, uid);
      await d.runAsync(`DELETE FROM vials WHERE ${where}`, uid);
      await d.runAsync(`DELETE FROM cycles WHERE ${where}`, uid);
      await d.runAsync(`DELETE FROM stacks WHERE ${where}`, uid);
      await d.runAsync(`DELETE FROM journal_entries WHERE ${where}`, uid);
      await d.runAsync(`DELETE FROM metrics WHERE ${where}`, uid);
      await d.runAsync(`DELETE FROM injection_sites_log WHERE ${where}`, uid);
      await d.runAsync(`DELETE FROM saved_peptides WHERE ${where}`, uid);
      await d.runAsync(`DELETE FROM dose_skips WHERE ${where}`, uid);
    } else {
      // Legacy local-only mode — wipe everything.
      await d.execAsync(`
        DELETE FROM doses;
        DELETE FROM vials;
        DELETE FROM cycles;
        DELETE FROM stacks;
        DELETE FROM journal_entries;
        DELETE FROM metrics;
        DELETE FROM injection_sites_log;
        DELETE FROM saved_peptides;
        DELETE FROM dose_skips;
      `);
    }
    // Profile is a singleton; wipe per-device acceptances + identifiers
    // in both modes so the user lands back on a fresh state.
    await d.execAsync(`
      UPDATE profile SET
        display_name = NULL, birth_year = NULL,
        onboarding_done = 0, terms_accepted_at = NULL,
        age_gate_accepted_at = NULL, disclaimer_accepted_at = NULL,
        local_data_attributed_at = NULL
      WHERE id = 1;
    `);
  });
}

// ---- Phase C: data attribution --------------------------------------------
//
// On first sign-in after the auth feature lands, the local SQLite has
// (potentially) rows where user_id IS NULL — data the device accumulated
// before accounts existed. The post-signup prompt asks the user whether
// to keep this data or wipe it. These helpers power that screen.

/**
 * True when there's at least one NULL-user_id row across every
 * user-owned table. Drives the "Keep your data?" prompt visibility.
 */
export async function hasLegacyLocalData(): Promise<boolean> {
  const d = db();
  for (const t of [
    'doses', 'vials', 'cycles', 'stacks', 'journal_entries',
    'metrics', 'injection_sites_log', 'saved_peptides', 'dose_skips',
  ]) {
    const row = await d.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${t} WHERE user_id IS NULL LIMIT 1`
    );
    if ((row?.n ?? 0) > 0) return true;
  }
  return false;
}

/**
 * Per-table counts of NULL-user_id rows. Used by the prompt to render
 * "47 doses, 3 vials, 2 cycles, 12 journal entries…" so the user knows
 * what they're keeping or losing.
 */
export async function legacyLocalDataCounts(): Promise<{
  doses: number;
  vials: number;
  cycles: number;
  stacks: number;
  journal: number;
  metrics: number;
  sites: number;
  saved: number;
  skips: number;
}> {
  const d = db();
  const get = async (t: string) => {
    const row = await d.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${t} WHERE user_id IS NULL`
    );
    return row?.n ?? 0;
  };
  return {
    doses: await get('doses'),
    vials: await get('vials'),
    cycles: await get('cycles'),
    stacks: await get('stacks'),
    journal: await get('journal_entries'),
    metrics: await get('metrics'),
    sites: await get('injection_sites_log'),
    saved: await get('saved_peptides'),
    skips: await get('dose_skips'),
  };
}

/**
 * Backfill every NULL-user_id row to belong to this user. Called when
 * the user taps "Keep my data" in the attribution prompt. Stamps
 * profile.local_data_attributed_at so the prompt never re-fires on
 * this device.
 */
export async function attributeLocalDataToUser(userId: string): Promise<void> {
  const d = db();
  await d.withTransactionAsync(async () => {
    for (const t of [
      'doses', 'vials', 'cycles', 'stacks', 'journal_entries',
      'metrics', 'injection_sites_log', 'saved_peptides', 'dose_skips',
    ]) {
      await d.runAsync(
        `UPDATE ${t} SET user_id = ? WHERE user_id IS NULL`,
        userId
      );
    }
    await d.runAsync(
      `UPDATE profile SET local_data_attributed_at = ? WHERE id = 1`,
      new Date().toISOString()
    );
  });
}

/**
 * "Start fresh" path from the attribution prompt — wipes every
 * NULL-user_id row without touching this user's existing data. Stamps
 * the attributed-at flag so the prompt doesn't re-fire.
 */
export async function discardLegacyLocalData(): Promise<void> {
  const d = db();
  await d.withTransactionAsync(async () => {
    for (const t of [
      'doses', 'vials', 'cycles', 'stacks', 'journal_entries',
      'metrics', 'injection_sites_log', 'saved_peptides', 'dose_skips',
    ]) {
      await d.runAsync(`DELETE FROM ${t} WHERE user_id IS NULL`);
    }
    await d.runAsync(
      `UPDATE profile SET local_data_attributed_at = ? WHERE id = 1`,
      new Date().toISOString()
    );
  });
}

// ---- Helpers ---------------------------------------------------------------

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
