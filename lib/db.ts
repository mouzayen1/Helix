// Local SQLite — spec §05 (subset).
// Phase 1 / Path A: no user_id, no cloud sync. Everything local.
// Extend with user_id + conflict resolution when we move to Phase 2.
import * as SQLite from 'expo-sqlite';
import { PEPTIDES } from './peptides';

const DB_NAME = 'helix.db';

let _db: SQLite.SQLiteDatabase | null = null;

function db(): SQLite.SQLiteDatabase {
  if (!_db) _db = SQLite.openDatabaseSync(DB_NAME);
  return _db;
}

export async function initDatabase() {
  const d = db();

  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS peptides (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subtitle TEXT,
      class TEXT,
      formula TEXT,
      half_life TEXT,
      color TEXT,
      summary TEXT,
      typical_dose TEXT,
      freq TEXT,
      route TEXT
    );

    CREATE TABLE IF NOT EXISTS vials (
      id TEXT PRIMARY KEY,
      peptide_id TEXT NOT NULL,
      strength_mg REAL NOT NULL,
      bac_water_ml REAL NOT NULL,
      remaining_mg REAL NOT NULL,
      reconstituted_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS doses (
      id TEXT PRIMARY KEY,
      peptide_id TEXT NOT NULL,
      vial_id TEXT,
      amount_mcg REAL NOT NULL,
      route TEXT,
      site TEXT,
      taken_at TEXT NOT NULL,
      note TEXT
    );
  `);

  // Seed peptides on first launch.
  const row = await d.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM peptides;');
  if (!row || row.n === 0) {
    for (const p of PEPTIDES) {
      await d.runAsync(
        `INSERT INTO peptides (id, name, subtitle, class, formula, half_life, color, summary, typical_dose, freq, route)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p.id,
        p.name,
        p.subtitle,
        p.class,
        p.formula,
        p.halfLife,
        p.color,
        p.summary,
        p.dosing.typical,
        p.dosing.freq,
        p.dosing.route
      );
    }
  }
}

export type DoseInsert = {
  peptide_id: string;
  amount_mcg: number;
  route: string;
  site: string;
  note?: string;
};

export async function insertDose(input: DoseInsert) {
  const d = db();
  const id = `dose_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await d.runAsync(
    `INSERT INTO doses (id, peptide_id, amount_mcg, route, site, taken_at, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.peptide_id,
    input.amount_mcg,
    input.route,
    input.site,
    new Date().toISOString(),
    input.note ?? null
  );
  return id;
}

export type DoseRow = {
  id: string;
  peptide_id: string;
  amount_mcg: number;
  route: string;
  site: string;
  taken_at: string;
  note: string | null;
};

export async function listDoses(limit = 50): Promise<DoseRow[]> {
  const d = db();
  return d.getAllAsync<DoseRow>(
    `SELECT id, peptide_id, amount_mcg, route, site, taken_at, note
     FROM doses ORDER BY taken_at DESC LIMIT ?`,
    limit
  );
}
