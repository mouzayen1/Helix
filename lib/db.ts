// Local SQLite — Helix spec v2.0 §05 / §14.
// Phase 1 / local-only (no user_id scoping). All user writes go here;
// Phase 2 will add outbox + sync to Supabase. Schema mirrors the server
// schema (same column names) so the migration is lossless.

import * as SQLite from 'expo-sqlite';
import { PEPTIDES } from './peptides';

const DB_NAME = 'helix.db';

let _db: SQLite.SQLiteDatabase | null = null;

function db(): SQLite.SQLiteDatabase {
  if (!_db) _db = SQLite.openDatabaseSync(DB_NAME);
  return _db;
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
};

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

// ---- Saved peptides --------------------------------------------------------

export async function isSaved(peptide_id: string): Promise<boolean> {
  const row = await db().getFirstAsync<{ peptide_id: string }>(
    'SELECT peptide_id FROM saved_peptides WHERE peptide_id = ?',
    peptide_id
  );
  return !!row;
}

export async function savePeptide(peptide_id: string) {
  await db().runAsync(
    'INSERT OR IGNORE INTO saved_peptides (peptide_id) VALUES (?)',
    peptide_id
  );
}

export async function unsavePeptide(peptide_id: string) {
  await db().runAsync('DELETE FROM saved_peptides WHERE peptide_id = ?', peptide_id);
}

export async function listSavedPeptides(): Promise<string[]> {
  const rows = await db().getAllAsync<{ peptide_id: string }>(
    'SELECT peptide_id FROM saved_peptides ORDER BY saved_at DESC'
  );
  return rows.map((r) => r.peptide_id);
}

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
  // v1.1 additions
  cost_usd: number | null;
  depleted_at: string | null;
  first_used_at: string | null;
  total_doses_drawn: number;
};

// v1.1: recorded intentional skip of a scheduled dose.
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

export async function createVial(input: {
  peptide_id: string;
  strength_mg: number;
  bac_water_ml: number;
  expires_in_days?: number;
  notes?: string;
}): Promise<string> {
  const id = genId('vial');
  const concentration = input.strength_mg / input.bac_water_ml;
  const now = new Date();
  const expires = new Date(now.getTime() + (input.expires_in_days ?? 30) * 864e5);
  // Deactivate any previous active vial for this peptide
  await db().runAsync(
    'UPDATE vials SET is_active = 0 WHERE peptide_id = ? AND is_active = 1',
    input.peptide_id
  );
  await db().runAsync(
    `INSERT INTO vials
      (id, peptide_id, strength_mg, bac_water_ml, concentration, remaining_mg,
       reconstituted_at, expires_at, notes, is_active)
     VALUES (?,?,?,?,?,?,?,?,?,1)`,
    id, input.peptide_id, input.strength_mg, input.bac_water_ml, concentration,
    input.strength_mg, now.toISOString(), expires.toISOString(), input.notes ?? null
  );
  return id;
}

export async function getActiveVial(peptide_id: string): Promise<Vial | null> {
  return db().getFirstAsync<Vial>(
    `SELECT * FROM vials WHERE peptide_id = ? AND is_active = 1
     ORDER BY reconstituted_at DESC LIMIT 1`,
    peptide_id
  );
}

export async function listActiveVials(): Promise<Vial[]> {
  return db().getAllAsync<Vial>(
    `SELECT * FROM vials WHERE is_active = 1 ORDER BY reconstituted_at DESC`
  );
}

export async function getVial(id: string): Promise<Vial | null> {
  return db().getFirstAsync<Vial>('SELECT * FROM vials WHERE id = ?', id);
}

export async function deactivateVial(id: string) {
  // v1.1: stamp depleted_at when is_active flips 1->0, iff not already set.
  await db().runAsync(
    `UPDATE vials
        SET is_active = 0,
            depleted_at = COALESCE(depleted_at, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE id = ?`,
    id
  );
}

export async function deleteVial(id: string) {
  // Clear the vial_id foreign key on any doses that referenced it,
  // then delete the vial row.
  const d = db();
  await d.withTransactionAsync(async () => {
    await d.runAsync('UPDATE doses SET vial_id = NULL WHERE vial_id = ?', id);
    await d.runAsync('DELETE FROM vials WHERE id = ?', id);
  });
}

// v1.1: restore a depleted vial back to active. Clears depleted_at.
export async function restoreVial(id: string) {
  await db().runAsync(
    'UPDATE vials SET is_active = 1, depleted_at = NULL WHERE id = ?',
    id
  );
}

// v1.1: vial history (is_active=0) newest first, with optional filter.
export async function getVialHistory(opts: { limit?: number; peptideId?: string } = {}): Promise<Vial[]> {
  const { limit = 100, peptideId } = opts;
  if (peptideId) {
    return db().getAllAsync<Vial>(
      `SELECT * FROM vials WHERE is_active = 0 AND peptide_id = ?
       ORDER BY depleted_at DESC, reconstituted_at DESC LIMIT ?`,
      peptideId, limit
    );
  }
  return db().getAllAsync<Vial>(
    `SELECT * FROM vials WHERE is_active = 0
     ORDER BY depleted_at DESC, reconstituted_at DESC LIMIT ?`,
    limit
  );
}

// v1.1: all vials for a peptide (active-only flag optional).
export async function getVialsForPeptide(peptideId: string, activeOnly = false): Promise<Vial[]> {
  if (activeOnly) {
    return db().getAllAsync<Vial>(
      `SELECT * FROM vials WHERE peptide_id = ? AND is_active = 1
       ORDER BY reconstituted_at DESC`,
      peptideId
    );
  }
  return db().getAllAsync<Vial>(
    `SELECT * FROM vials WHERE peptide_id = ?
     ORDER BY is_active DESC, reconstituted_at DESC`,
    peptideId
  );
}

// v1.1: alias matching the spec name.
export const getVialById = getVial;

// v1.1: all doses drawn from a specific vial (timeline on vial detail).
export async function getDosesForVial(vialId: string): Promise<Dose[]> {
  return db().getAllAsync<Dose>(
    'SELECT * FROM doses WHERE vial_id = ? ORDER BY taken_at DESC',
    vialId
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
  const d = db();
  await d.withTransactionAsync(async () => {
    const current = await d.getFirstAsync<Vial>('SELECT * FROM vials WHERE id = ?', id);
    if (!current) return;

    const newStrength = patch.strength_mg ?? current.strength_mg;
    const newBac = patch.bac_water_ml ?? current.bac_water_ml;
    const recomputeConc = newStrength !== current.strength_mg || newBac !== current.bac_water_ml;
    const newConc = newStrength / newBac;

    let newRemaining = current.remaining_mg;
    if (patch.strength_mg !== undefined && patch.strength_mg !== current.strength_mg) {
      const sum = await d.getFirstAsync<{ drawn_mg: number | null }>(
        'SELECT COALESCE(SUM(amount_mcg), 0) / 1000.0 AS drawn_mg FROM doses WHERE vial_id = ?',
        id
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
    vals.push(id);
    await d.runAsync(`UPDATE vials SET ${sets.join(', ')} WHERE id = ?`, ...vals);
  });
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
    const params = [...values, id];
    await d.runAsync(`UPDATE doses SET ${sets.join(', ')} WHERE id = ?`, ...params);

    if (patch.site !== undefined || patch.taken_at !== undefined) {
      await d.runAsync('DELETE FROM injection_sites_log WHERE dose_id = ?', id);
      if (patch.site) {
        const dose = await d.getFirstAsync<{ taken_at: string }>(
          'SELECT taken_at FROM doses WHERE id = ?',
          id
        );
        if (dose) {
          const sid = `site_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
          await d.runAsync(
            'INSERT INTO injection_sites_log (id, site, used_at, dose_id) VALUES (?,?,?,?)',
            sid, patch.site, dose.taken_at, id
          );
        }
      }
    }
  });
}

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
        WHERE peptide_id = ? AND is_active = 1
        ORDER BY (expires_at IS NULL) ASC, expires_at ASC, reconstituted_at ASC
        LIMIT 1`,
      input.peptide_id
    );
    if (auto) vial_id = auto.id;
  }

  await d.withTransactionAsync(async () => {
    await d.runAsync(
      `INSERT INTO doses (id, peptide_id, vial_id, cycle_id, amount_mcg, volume_units,
                          route, site, taken_at, note)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      id, input.peptide_id, vial_id, input.cycle_id ?? null,
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
         WHERE id = ?`,
        amount_mg, taken_at, vial_id
      );
    }
    if (input.site) {
      const sid = genId('site');
      await d.runAsync(
        `INSERT INTO injection_sites_log (id, site, used_at, dose_id) VALUES (?,?,?,?)`,
        sid, input.site, taken_at, id
      );
    }
  });
  return id;
}

export async function listDoses(opts: { limit?: number; from?: string; to?: string } = {}): Promise<Dose[]> {
  const { limit = 50, from, to } = opts;
  let sql = 'SELECT * FROM doses';
  const args: unknown[] = [];
  const where: string[] = [];
  if (from) { where.push('taken_at >= ?'); args.push(from); }
  if (to) { where.push('taken_at <= ?'); args.push(to); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY taken_at DESC LIMIT ?';
  args.push(limit);
  return db().getAllAsync<Dose>(sql, ...args as (string | number)[]);
}

export async function deleteDose(id: string) {
  const dose = await db().getFirstAsync<Dose>('SELECT * FROM doses WHERE id = ?', id);
  if (!dose) return;
  const d = db();
  await d.withTransactionAsync(async () => {
    if (dose.vial_id) {
      await d.runAsync(
        'UPDATE vials SET remaining_mg = remaining_mg + ? WHERE id = ?',
        dose.amount_mcg / 1000, dose.vial_id
      );
    }
    await d.runAsync('DELETE FROM injection_sites_log WHERE dose_id = ?', id);
    await d.runAsync('DELETE FROM doses WHERE id = ?', id);
  });
}

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
  // v1.1 additions
  paused_at: string | null;
  paused_total_days: number;
};

export type CycleProtocolItem = {
  peptide_id: string;
  dose_mcg: number;
  freq: string;       // 'daily' | 'weekly' | 'every other day' | etc.
  time_of_day: string; // 'morning' | 'evening' | 'HH:MM'
};

export async function createCycle(input: {
  name: string;
  starts_on: string;
  ends_on: string;
  phase?: Cycle['phase'];
  stack_id?: string | null;
  protocol: CycleProtocolItem[];
  notes?: string;
}): Promise<string> {
  const id = genId('cycle');
  await db().runAsync(
    `INSERT INTO cycles (id, name, starts_on, ends_on, phase, status, stack_id, protocol_json, notes)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    id, input.name, input.starts_on, input.ends_on,
    input.phase ?? 'active', 'active', input.stack_id ?? null,
    JSON.stringify(input.protocol), input.notes ?? null
  );
  return id;
}

export async function getActiveCycle(): Promise<Cycle | null> {
  return db().getFirstAsync<Cycle>(
    `SELECT * FROM cycles WHERE status = 'active' ORDER BY starts_on DESC LIMIT 1`
  );
}

export async function listCycles(): Promise<Cycle[]> {
  return db().getAllAsync<Cycle>('SELECT * FROM cycles ORDER BY starts_on DESC');
}

export async function endCycle(id: string) {
  await db().runAsync(`UPDATE cycles SET status = 'complete' WHERE id = ?`, id);
}

// v1.1: pause an active cycle. Today stops scheduling from it until resumed.
export async function pauseCycle(id: string) {
  await db().runAsync(
    `UPDATE cycles
        SET status = 'paused',
            paused_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    id
  );
}

// v1.1: resume a paused cycle. Shifts ends_on forward by the paused span
// and accumulates paused_total_days. Clears paused_at.
export async function resumeCycle(id: string) {
  const d = db();
  await d.withTransactionAsync(async () => {
    const row = await d.getFirstAsync<Cycle>('SELECT * FROM cycles WHERE id = ?', id);
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
        WHERE id = ?`,
      pausedDays, newEnds, id
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
  const id = genId('skip');
  await db().runAsync(
    `INSERT INTO dose_skips
       (id, peptide_id, cycle_id, scheduled_date, time_of_day, reason, note, created_at)
     VALUES (?,?,?,?,?,?,?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
    id,
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
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (opts.from) { where.push('scheduled_date >= ?'); args.push(opts.from); }
  if (opts.to) { where.push('scheduled_date <= ?'); args.push(opts.to); }
  if (opts.cycle_id) { where.push('cycle_id = ?'); args.push(opts.cycle_id); }
  const sql = `SELECT * FROM dose_skips${
    where.length ? ' WHERE ' + where.join(' AND ') : ''
  } ORDER BY scheduled_date DESC`;
  return db().getAllAsync<DoseSkip>(sql, ...args);
}

export async function deleteDoseSkip(id: string) {
  await db().runAsync('DELETE FROM dose_skips WHERE id = ?', id);
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
  values.push(id);
  await db().runAsync(`UPDATE cycles SET ${sets.join(', ')} WHERE id = ?`, ...values);
}

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

export async function createStack(input: {
  name: string;
  goal?: string;
  items: StackItem[];
  synergy_score?: number;
}): Promise<string> {
  const id = genId('stack');
  await db().runAsync(
    `INSERT INTO stacks (id, name, goal, items_json, synergy_score)
     VALUES (?,?,?,?,?)`,
    id, input.name, input.goal ?? null, JSON.stringify(input.items),
    input.synergy_score ?? null
  );
  return id;
}

export async function listStacks(): Promise<Stack[]> {
  return db().getAllAsync<Stack>('SELECT * FROM stacks ORDER BY created_at DESC');
}

export async function getStack(id: string): Promise<Stack | null> {
  return db().getFirstAsync<Stack>('SELECT * FROM stacks WHERE id = ?', id);
}

export async function deleteStack(id: string) {
  await db().runAsync('DELETE FROM stacks WHERE id = ?', id);
}

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
  const existing = await db().getFirstAsync<JournalEntry>(
    'SELECT * FROM journal_entries WHERE entry_date = ?',
    input.entry_date
  );
  if (existing) {
    await db().runAsync(
      `UPDATE journal_entries SET mood = ?, energy = ?, sleep_hours = ?, sleep_quality = ?,
         libido = ?, recovery = ?, tags_json = ?, body = ?, updated_at = datetime('now')
       WHERE entry_date = ?`,
      input.mood ?? existing.mood, input.energy ?? existing.energy,
      input.sleep_hours ?? existing.sleep_hours, input.sleep_quality ?? existing.sleep_quality,
      input.libido ?? existing.libido, input.recovery ?? existing.recovery,
      JSON.stringify(input.tags ?? JSON.parse(existing.tags_json)),
      input.body ?? existing.body, input.entry_date
    );
    return existing.id;
  }
  const id = genId('jrnl');
  await db().runAsync(
    `INSERT INTO journal_entries
       (id, entry_date, mood, energy, sleep_hours, sleep_quality, libido, recovery, tags_json, body)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    id, input.entry_date, input.mood ?? null, input.energy ?? null,
    input.sleep_hours ?? null, input.sleep_quality ?? null,
    input.libido ?? null, input.recovery ?? null,
    JSON.stringify(input.tags ?? []), input.body ?? null
  );
  return id;
}

export async function getJournal(entry_date: string): Promise<JournalEntry | null> {
  return db().getFirstAsync<JournalEntry>(
    'SELECT * FROM journal_entries WHERE entry_date = ?',
    entry_date
  );
}

export async function listJournal(limit = 30): Promise<JournalEntry[]> {
  return db().getAllAsync<JournalEntry>(
    'SELECT * FROM journal_entries ORDER BY entry_date DESC LIMIT ?',
    limit
  );
}

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

export async function insertMetric(input: {
  kind: string;
  value: number;
  unit?: string;
  taken_at?: string;
  note?: string;
}): Promise<string> {
  const id = genId('metric');
  const kind_info = METRIC_KINDS.find((k) => k.id === input.kind);
  await db().runAsync(
    `INSERT INTO metrics (id, kind, value, unit, taken_at, source, note)
     VALUES (?,?,?,?,?,?,?)`,
    id, input.kind, input.value,
    input.unit ?? kind_info?.unit ?? null,
    input.taken_at ?? new Date().toISOString(),
    'manual', input.note ?? null
  );
  return id;
}

export async function listMetrics(kind: string, limit = 90): Promise<Metric[]> {
  return db().getAllAsync<Metric>(
    'SELECT * FROM metrics WHERE kind = ? ORDER BY taken_at DESC LIMIT ?',
    kind, limit
  );
}

export async function listAllMetricKindsWithLatest(): Promise<{ kind: string; latest: Metric | null }[]> {
  const out: { kind: string; latest: Metric | null }[] = [];
  for (const k of METRIC_KINDS) {
    const latest = await db().getFirstAsync<Metric>(
      'SELECT * FROM metrics WHERE kind = ? ORDER BY taken_at DESC LIMIT 1',
      k.id
    );
    out.push({ kind: k.id, latest });
  }
  return out;
}

export async function deleteMetric(id: string) {
  await db().runAsync('DELETE FROM metrics WHERE id = ?', id);
}

// ---- Injection-site rotation -----------------------------------------------

export const INJECTION_SITES = [
  'L.Deltoid', 'R.Deltoid',
  'L.Abdomen', 'R.Abdomen',
  'L.Hip', 'R.Hip',
  'L.Thigh', 'R.Thigh',
] as const;

export type SiteSuggestion = { site: string; days_since: number; total_uses: number };

export async function siteSuggestion(): Promise<SiteSuggestion> {
  const d = db();
  const now = Date.now();
  const history = await d.getAllAsync<{ site: string; last_used: string; uses: number }>(
    `SELECT site, MAX(used_at) AS last_used, COUNT(*) AS uses
     FROM injection_sites_log GROUP BY site`
  );
  const map = new Map(history.map((h) => [h.site, h]));
  const scored: SiteSuggestion[] = INJECTION_SITES.map((site) => {
    const h = map.get(site);
    const days_since = h
      ? Math.floor((now - new Date(h.last_used).getTime()) / 864e5)
      : 999;
    return { site, days_since, total_uses: h?.uses ?? 0 };
  });
  scored.sort((a, b) => b.days_since - a.days_since || a.total_uses - b.total_uses);
  return scored[0];
}

export async function siteRecency(): Promise<SiteSuggestion[]> {
  const now = Date.now();
  const history = await db().getAllAsync<{ site: string; last_used: string; uses: number }>(
    `SELECT site, MAX(used_at) AS last_used, COUNT(*) AS uses
     FROM injection_sites_log GROUP BY site`
  );
  const map = new Map(history.map((h) => [h.site, h]));
  return INJECTION_SITES.map((site) => {
    const h = map.get(site);
    return {
      site,
      days_since: h ? Math.floor((now - new Date(h.last_used).getTime()) / 864e5) : 999,
      total_uses: h?.uses ?? 0,
    };
  });
}

// ---- Export ----------------------------------------------------------------

export const SCHEMA_VERSION = 2;

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
  const d = db();
  return {
    profile: await getProfile(),
    cycles: await listCycles(),
    doses: await d.getAllAsync<Dose>('SELECT * FROM doses ORDER BY taken_at DESC'),
    vials: await d.getAllAsync<Vial>('SELECT * FROM vials ORDER BY reconstituted_at DESC'),
    stacks: await listStacks(),
    metrics: await d.getAllAsync<Metric>('SELECT * FROM metrics ORDER BY taken_at DESC'),
    journal: await listJournal(1000),
    dose_skips: await d.getAllAsync<DoseSkip>('SELECT * FROM dose_skips ORDER BY scheduled_date DESC'),
    saved_peptides: await listSavedPeptides(),
    exported_at: new Date().toISOString(),
    schema_version: SCHEMA_VERSION,
  };
}

export const exportAll = exportAllData;

export async function deleteAllUserData() {
  const d = db();
  await d.withTransactionAsync(async () => {
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
      UPDATE profile SET
        display_name = NULL, birth_year = NULL,
        onboarding_done = 0, terms_accepted_at = NULL,
        age_gate_accepted_at = NULL, disclaimer_accepted_at = NULL
      WHERE id = 1;
    `);
  });
}

// ---- Helpers ---------------------------------------------------------------

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
