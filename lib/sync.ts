// Cross-device sync engine — bidirectional delta sync between the local
// SQLite (lib/db.ts) and Supabase. Runs on app launch and on foreground
// when the user is signed in. v1 scope:
//   • PULL: read Supabase rows where remote.updated_at > local high-water
//     mark, upsert into local SQLite. Remote wins on conflict.
//   • PUSH: read local rows where local.updated_at > remote high-water
//     mark, upsert into Supabase. Best-effort — errors are logged and
//     the next sync trigger retries.
//   • CONFLICT POLICY: last-write-wins by updated_at. Same-second writes
//     on two devices race; the loser is silently overwritten. Acceptable
//     for v1 — peptide tracking is single-user, multi-device, not
//     concurrent collaboration.
//
// What's NOT in v1:
//   • Real-time write-through (dual-write on every save). Writes done
//     between sync triggers ride the local SQLite until the next launch
//     / foreground transition pushes them. That's good enough for the
//     "I created a cycle on my phone, opened the web app" use case.
//   • Tombstone-based deletion sync. A row deleted locally won't be
//     deleted remotely (and vice versa) until v1.1. Workaround: deletes
//     are rare and users can re-delete from each surface.
//   • Offline queue with retry backoff. If push fails offline, it
//     retries on the next sync trigger.
//
// Web (lib/sync.web.ts) is a no-op — the web app already reads/writes
// Supabase directly.

import { getDb, getCurrentUserId } from './db';
import { isAuthConfigured, supabase } from './supabase';

// Tables synced bidirectionally. peptides is excluded (global catalog,
// shipped via seed). profile is handled separately due to schema mapping.
const ROW_TABLES = [
  'saved_peptides',
  'vials',
  'cycles',
  'stacks',
  'doses',
  'journal_entries',
  'metrics',
  'injection_sites_log',
  'dose_skips',
] as const;

type SyncResult = {
  pulled: number;
  pushed: number;
  errors: string[];
};

// Canonicalise any timestamp string into ISO 'YYYY-MM-DDTHH:MM:SS.sssZ'
// so a single text comparison works across Supabase (+00:00) and SQLite
// (Z from strftime('%f', 'now')) representations.
function toIsoZ(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

let syncInFlight = false;

/**
 * Run a full bidirectional sync for the current user. Idempotent —
 * safe to call multiple times; in-flight calls coalesce. No-op when
 * Supabase isn't configured or no user is signed in.
 */
export async function syncAll(): Promise<SyncResult> {
  const result: SyncResult = { pulled: 0, pushed: 0, errors: [] };
  if (!isAuthConfigured()) return result;
  const sb = supabase();
  if (!sb) return result;
  const userId = getCurrentUserId();
  if (!userId) return result;

  if (syncInFlight) return result;
  syncInFlight = true;
  try {
    // Profile first — RootGate routes off it, so a fresh pull matters
    // before any tab screen renders.
    try {
      const n = await syncProfile(userId, sb);
      result.pulled += n;
    } catch (e) {
      result.errors.push(`profile: ${String(e)}`);
    }

    for (const t of ROW_TABLES) {
      try {
        const partial = await syncTable(t, userId, sb);
        result.pulled += partial.pulled;
        result.pushed += partial.pushed;
      } catch (e) {
        result.errors.push(`${t}: ${String(e)}`);
      }
    }
    return result;
  } finally {
    syncInFlight = false;
  }
}

// ─── Profile (singleton local row ↔ per-user remote row) ────────────────
async function syncProfile(
  userId: string,
  sb: NonNullable<ReturnType<typeof supabase>>,
): Promise<number> {
  const d = getDb();
  const local = (await d.getFirstAsync<{
    updated_at: string | null;
    display_name: string | null;
    birth_year: number | null;
    unit_weight: string;
    unit_volume: string;
    theme: string;
    terms_version: string | null;
    terms_accepted_at: string | null;
    age_gate_accepted_at: string | null;
    disclaimer_accepted_at: string | null;
    onboarding_done: number;
    notifications_enabled: number;
    biometric_lock: number;
    notif_prefs_json: string | null;
    dismissed_banners: string | null;
    dose_unit_pref: string;
  }>(
    `SELECT updated_at, display_name, birth_year, unit_weight, unit_volume,
            theme, terms_version, terms_accepted_at, age_gate_accepted_at,
            disclaimer_accepted_at, onboarding_done, notifications_enabled,
            biometric_lock, notif_prefs_json, dismissed_banners, dose_unit_pref
       FROM profile WHERE id = 1`,
  )) ?? null;

  const { data: remoteData, error } = await sb
    .from('profiles')
    .select(
      'updated_at, display_name, birth_year, unit_weight, unit_volume, theme, ' +
        'terms_version, terms_accepted_at, age_confirmed_at, disclaimer_accepted_at, ' +
        'onboarding_done, notifications_enabled, biometric_lock, notif_prefs_json, ' +
        'dismissed_banners, dose_unit_pref',
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  // Supabase's select(string) returns a typed union that includes a
  // parse-error variant — TS can't narrow it after the runtime error
  // check, so cast to the concrete row shape here.
  const remoteRow = remoteData as {
    updated_at: string | null;
    display_name: string | null;
    birth_year: number | null;
    unit_weight: string;
    unit_volume: string;
    theme: string;
    terms_version: string | null;
    terms_accepted_at: string | null;
    age_confirmed_at: string | null;
    disclaimer_accepted_at: string | null;
    onboarding_done: boolean | null;
    notifications_enabled: boolean | null;
    biometric_lock: boolean | null;
    notif_prefs_json: string | null;
    dismissed_banners: string | null;
    dose_unit_pref: string | null;
  } | null;

  const localT = toIsoZ(local?.updated_at ?? null);
  const remoteT = toIsoZ(remoteRow?.updated_at ?? null);

  if (remoteRow && (!localT || (remoteT && remoteT > localT))) {
    await d.runAsync(
      `UPDATE profile SET
         display_name = ?, birth_year = ?, unit_weight = ?, unit_volume = ?,
         theme = ?, terms_version = ?, terms_accepted_at = ?,
         age_gate_accepted_at = ?, disclaimer_accepted_at = ?,
         onboarding_done = ?, notifications_enabled = ?, biometric_lock = ?,
         notif_prefs_json = ?, dismissed_banners = ?, dose_unit_pref = ?,
         updated_at = ?
       WHERE id = 1`,
      [
        remoteRow.display_name ?? null,
        remoteRow.birth_year ?? null,
        remoteRow.unit_weight,
        remoteRow.unit_volume,
        remoteRow.theme,
        remoteRow.terms_version ?? null,
        remoteRow.terms_accepted_at ?? null,
        remoteRow.age_confirmed_at ?? null,
        remoteRow.disclaimer_accepted_at ?? null,
        remoteRow.onboarding_done ? 1 : 0,
        remoteRow.notifications_enabled ? 1 : 0,
        remoteRow.biometric_lock ? 1 : 0,
        remoteRow.notif_prefs_json ?? null,
        remoteRow.dismissed_banners ?? '[]',
        remoteRow.dose_unit_pref ?? 'auto',
        remoteT,
      ],
    );
    return 1;
  }

  if (local && localT && (!remoteT || localT > remoteT)) {
    await sb
      .from('profiles')
      .update({
        display_name: local.display_name,
        birth_year: local.birth_year,
        unit_weight: local.unit_weight,
        unit_volume: local.unit_volume,
        theme: local.theme,
        terms_version: local.terms_version,
        terms_accepted_at: local.terms_accepted_at,
        age_confirmed_at: local.age_gate_accepted_at,
        disclaimer_accepted_at: local.disclaimer_accepted_at,
        onboarding_done: !!local.onboarding_done,
        notifications_enabled: !!local.notifications_enabled,
        biometric_lock: !!local.biometric_lock,
        notif_prefs_json: local.notif_prefs_json,
        dismissed_banners: local.dismissed_banners,
        dose_unit_pref: local.dose_unit_pref,
      })
      .eq('user_id', userId);
  }
  return 0;
}

// ─── Generic per-table sync ───────────────────────────────────────
async function syncTable(
  table: typeof ROW_TABLES[number],
  userId: string,
  sb: NonNullable<ReturnType<typeof supabase>>,
): Promise<{ pulled: number; pushed: number }> {
  const d = getDb();
  let pulled = 0;
  let pushed = 0;

  // --- PULL ---
  const localMaxRaw = (
    await d.getFirstAsync<{ m: string | null }>(
      `SELECT MAX(updated_at) AS m FROM ${table} WHERE user_id = ?`,
      [userId],
    )
  )?.m ?? null;
  const localMaxIso = toIsoZ(localMaxRaw);

  let pullQ = sb.from(table).select('*').eq('user_id', userId);
  if (localMaxIso) pullQ = pullQ.gt('updated_at', localMaxIso);
  const { data: remoteRows, error: pullErr } = await pullQ;
  if (pullErr) throw new Error(pullErr.message);

  for (const row of remoteRows ?? []) {
    upsertLocalRow(table, row);
    pulled++;
  }

  // --- PUSH ---
  // After the pull, local rows whose updated_at exceeds the highest
  // remote updated_at we've seen are the candidates to push. Compute
  // remoteHigh in canonical form and filter in JS to dodge SQLite/PG
  // text-compare format mismatches.
  let remoteHigh: string | null = localMaxIso;
  for (const r of remoteRows ?? []) {
    const t = toIsoZ((r as { updated_at?: string | null }).updated_at ?? null);
    if (t && (!remoteHigh || t > remoteHigh)) remoteHigh = t;
  }

  const localRows = await d.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE user_id = ?`,
    [userId],
  );
  const toPush = localRows.filter((r) => {
    const t = toIsoZ((r.updated_at as string | null) ?? null);
    if (!t) return false; // never push rows without a timestamp
    return !remoteHigh || t > remoteHigh;
  });

  if (toPush.length > 0) {
    const cleaned = toPush.map((row) => {
      const out: Record<string, unknown> = { ...row };
      if ('is_active' in out && typeof out.is_active === 'number') {
        out.is_active = out.is_active === 1;
      }
      // Normalise updated_at to ISO Z form so Supabase accepts it as
      // a timestamptz value (SQLite's text format isn't directly parseable).
      const u = out.updated_at;
      if (typeof u === 'string') out.updated_at = toIsoZ(u) ?? u;
      return out;
    });
    const onConflict = table === 'saved_peptides' ? 'user_id,peptide_id' : 'id';
    const { error: pushErr } = await sb.from(table).upsert(cleaned, { onConflict });
    if (pushErr) throw new Error(pushErr.message);
    pushed = cleaned.length;
  }

  return { pulled, pushed };
}

// Upsert a remote row into local SQLite. Generic — columns are inferred
// from the row object. Booleans coerced to 0/1 to match SQLite storage.
function upsertLocalRow(table: string, row: Record<string, unknown>): void {
  const d = getDb();
  const cols = Object.keys(row);
  if (cols.length === 0) return;
  const placeholders = cols.map(() => '?').join(',');
  const values = cols.map((c) => {
    const v = row[c];
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (c === 'updated_at' && typeof v === 'string') return toIsoZ(v) ?? v;
    return v ?? null;
  });
  d.runSync(
    `INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`,
    values as never[],
  );
}
