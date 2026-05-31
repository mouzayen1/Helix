// Web data layer — Supabase-backed implementation of the same surface as
// lib/db.ts. Metro resolves THIS file for `@/lib/db` on the web target
// (the `.web.ts` extension wins), so no screen import changes. The native
// apps keep lib/db.ts (local SQLite, source of truth on iOS/Android).
//
// Why online-first on web: iOS Safari evicts script-writable storage after
// ~7 days, so a local-SQLite-as-truth model is unreliable in the browser.
// Here Supabase is the source of truth; the browser reads/writes it
// directly with the signed-in user's JWT. RLS (supabase/migrations/0002 +
// 0007) enforces per-user scoping server-side — every query below is also
// explicitly scoped by user_id for parity with the native layer.
//
// Schema mapping note: the server `profiles` table is keyed by auth
// user_id (not a singleton id=1 row) and names a few columns differently
// from the local SQLite `profile` table (e.g. age_confirmed_at vs
// age_gate_accepted_at). getProfile/updateProfile translate between the
// shared Profile shape (lib/db-types.ts) and the server columns. The
// 0007 migration adds the columns the local schema had but the server
// lacked (profiles.onboarding_done/birth_year, journal libido/recovery/
// tags_json/body, dose_skips.note) so this mapping is lossless.

import { requireSupabase } from './supabase';
import {
  METRIC_KINDS,
  INJECTION_SITES,
  SCHEMA_VERSION,
  type Profile,
  type Vial,
  type DoseSkip,
  type Dose,
  type Cycle,
  type CycleProtocolItem,
  type Stack,
  type StackItem,
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
} from './db-types';

// ---- Current user context (mirrors lib/db.ts) -----------------------------
// session.ts pushes the Supabase user UUID here on sign-in / refresh, and
// null on sign-out. Same module-state contract as the native layer so
// non-React callers (notifications) can read it synchronously.

let _currentUserId: string | null = null;

export function setCurrentUserId(id: string | null): void {
  _currentUserId = id;
}

export function getCurrentUserId(): string | null {
  return _currentUserId;
}

export function requireUserId(): string {
  if (!_currentUserId) {
    throw new Error(
      'No active user — call setCurrentUserId() before this query, ' +
        'or move the query inside an auth-gated screen.',
    );
  }
  return _currentUserId;
}

// ---- Helpers ---------------------------------------------------------------

function sb() {
  return requireSupabase();
}

/** Throw on a PostgREST error; otherwise return data. */
function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// On web the Supabase schema already exists and the profile row is created
// server-side by the handle_new_user trigger on signup. Nothing to migrate
// or seed in the browser — initDatabase is a no-op so the shared launch
// path (app/_layout.tsx) works unchanged.
export async function initDatabase(): Promise<void> {
  return;
}

// ---- Profile ---------------------------------------------------------------

const PROFILE_COLUMNS =
  'user_id, display_name, birth_year, unit_weight, unit_volume, theme, ' +
  'terms_version, terms_accepted_at, age_confirmed_at, disclaimer_accepted_at, ' +
  'onboarding_done, notifications_enabled, biometric_lock, notif_prefs_json, ' +
  'dismissed_banners, dose_unit_pref, local_data_attributed_at';

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  birth_year: number | null;
  unit_weight: Profile['unit_weight'];
  unit_volume: Profile['unit_volume'];
  theme: Profile['theme'];
  terms_version: string | null;
  terms_accepted_at: string | null;
  age_confirmed_at: string | null;
  disclaimer_accepted_at: string | null;
  onboarding_done: boolean | null;
  notifications_enabled: boolean | null;
  biometric_lock: boolean | null;
  notif_prefs_json: string | null;
  dismissed_banners: string | null;
  dose_unit_pref: Profile['dose_unit_pref'] | null;
  local_data_attributed_at: string | null;
};

function rowToProfile(r: ProfileRow): Profile {
  return {
    local_user_id: r.user_id,
    display_name: r.display_name ?? null,
    birth_year: r.birth_year ?? null,
    unit_weight: r.unit_weight,
    unit_volume: r.unit_volume,
    theme: r.theme,
    terms_version: r.terms_version ?? null,
    terms_accepted_at: r.terms_accepted_at ?? null,
    age_gate_accepted_at: r.age_confirmed_at ?? null,
    disclaimer_accepted_at: r.disclaimer_accepted_at ?? null,
    onboarding_done: r.onboarding_done ? 1 : 0,
    notifications_enabled: r.notifications_enabled ? 1 : 0,
    biometric_lock: r.biometric_lock ? 1 : 0,
    notif_prefs_json: r.notif_prefs_json ?? null,
    dismissed_banners: r.dismissed_banners ?? '[]',
    dose_unit_pref: r.dose_unit_pref ?? 'auto',
    local_data_attributed_at: r.local_data_attributed_at ?? null,
  };
}

export async function getProfile(): Promise<Profile | null> {
  // Pre-auth boot calls this before setCurrentUserId fires (ProfileProvider's
  // mount effect runs before Supabase session hydrate finishes). On native
  // there's a local SQLite profile to return; on web there's nothing to
  // fetch without a user_id, so return null — same shape callers already
  // handle when the user has no profile row yet.
  const uid = getCurrentUserId();
  if (!uid) return null;
  const data = must(
    await sb().from('profiles').select(PROFILE_COLUMNS).eq('user_id', uid).maybeSingle()
  ) as ProfileRow | null;
  return data ? rowToProfile(data) : null;
}

export async function updateProfile(patch: Partial<Profile>): Promise<void> {
  const uid = requireUserId();
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    switch (k) {
      case 'local_user_id':
        break; // identity, not writable
      case 'age_gate_accepted_at':
        out.age_confirmed_at = v;
        break;
      case 'onboarding_done':
      case 'notifications_enabled':
      case 'biometric_lock':
        out[k] = !!v; // server columns are BOOLEAN
        break;
      default:
        out[k] = v;
    }
  }
  if (Object.keys(out).length === 0) return;
  must(await sb().from('profiles').update(out).eq('user_id', uid));
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

export async function isSaved(peptide_id: string): Promise<boolean> {
  const uid = requireUserId();
  const data = must(
    await sb()
      .from('saved_peptides')
      .select('peptide_id')
      .eq('peptide_id', peptide_id)
      .eq('user_id', uid)
      .maybeSingle()
  );
  return !!data;
}

export async function savePeptide(peptide_id: string): Promise<void> {
  const uid = requireUserId();
  must(
    await sb()
      .from('saved_peptides')
      .upsert({ peptide_id, user_id: uid }, { onConflict: 'user_id,peptide_id' })
  );
}

export async function unsavePeptide(peptide_id: string): Promise<void> {
  const uid = requireUserId();
  must(
    await sb().from('saved_peptides').delete().eq('peptide_id', peptide_id).eq('user_id', uid)
  );
}

export async function listSavedPeptides(): Promise<string[]> {
  const uid = requireUserId();
  const rows = (must(
    await sb()
      .from('saved_peptides')
      .select('peptide_id')
      .eq('user_id', uid)
      .order('saved_at', { ascending: false })
  ) ?? []) as { peptide_id: string }[];
  return rows.map((r) => r.peptide_id);
}

// ---- Vials -----------------------------------------------------------------

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
  // Deactivate any previous active vial for this peptide (this user only).
  must(
    await sb()
      .from('vials')
      .update({ is_active: 0 })
      .eq('peptide_id', input.peptide_id)
      .eq('is_active', 1)
      .eq('user_id', uid)
  );
  must(
    await sb().from('vials').insert({
      id,
      user_id: uid,
      peptide_id: input.peptide_id,
      strength_mg: input.strength_mg,
      bac_water_ml: input.bac_water_ml,
      concentration,
      remaining_mg: input.strength_mg,
      reconstituted_at: now.toISOString(),
      expires_at: expires.toISOString(),
      notes: input.notes ?? null,
      is_active: 1,
    })
  );
  return id;
}

export async function getActiveVial(peptide_id: string): Promise<Vial | null> {
  const uid = requireUserId();
  return (must(
    await sb()
      .from('vials')
      .select('*')
      .eq('peptide_id', peptide_id)
      .eq('is_active', 1)
      .eq('user_id', uid)
      .order('reconstituted_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ) as Vial | null);
}

export async function listActiveVials(): Promise<Vial[]> {
  const uid = requireUserId();
  return (must(
    await sb()
      .from('vials')
      .select('*')
      .eq('is_active', 1)
      .eq('user_id', uid)
      .order('reconstituted_at', { ascending: false })
  ) ?? []) as Vial[];
}

export async function getVial(id: string): Promise<Vial | null> {
  const uid = requireUserId();
  return (must(
    await sb().from('vials').select('*').eq('id', id).eq('user_id', uid).maybeSingle()
  ) as Vial | null);
}

export async function deactivateVial(id: string): Promise<void> {
  const uid = requireUserId();
  const current = await getVial(id);
  if (!current) return;
  must(
    await sb()
      .from('vials')
      .update({ is_active: 0, depleted_at: current.depleted_at ?? new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', uid)
  );
}

export async function deleteVial(id: string): Promise<void> {
  const uid = requireUserId();
  // Clear the FK on doses that referenced it, then delete the vial.
  must(await sb().from('doses').update({ vial_id: null }).eq('vial_id', id).eq('user_id', uid));
  must(await sb().from('vials').delete().eq('id', id).eq('user_id', uid));
}

export async function restoreVial(id: string): Promise<void> {
  const uid = requireUserId();
  must(
    await sb()
      .from('vials')
      .update({ is_active: 1, depleted_at: null })
      .eq('id', id)
      .eq('user_id', uid)
  );
}

export async function getVialHistory(
  opts: { limit?: number; peptideId?: string } = {}
): Promise<Vial[]> {
  const uid = requireUserId();
  const { limit = 100, peptideId } = opts;
  let q = sb().from('vials').select('*').eq('is_active', 0).eq('user_id', uid);
  if (peptideId) q = q.eq('peptide_id', peptideId);
  return (must(
    await q
      .order('depleted_at', { ascending: false, nullsFirst: false })
      .order('reconstituted_at', { ascending: false })
      .limit(limit)
  ) ?? []) as Vial[];
}

export async function getVialsForPeptide(peptideId: string, activeOnly = false): Promise<Vial[]> {
  const uid = requireUserId();
  let q = sb().from('vials').select('*').eq('peptide_id', peptideId).eq('user_id', uid);
  if (activeOnly) {
    q = q.eq('is_active', 1).order('reconstituted_at', { ascending: false });
  } else {
    q = q
      .order('is_active', { ascending: false })
      .order('reconstituted_at', { ascending: false });
  }
  return (must(await q) ?? []) as Vial[];
}

export const getVialById = getVial;

// ---- Vial ↔ cycle attachment ----------------------------------------------

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
  const cutoff = new Date(Date.now() - 30 * 864e5).toISOString();
  return (must(
    await sb()
      .from('vials')
      .select('*')
      .in('peptide_id', peptideIds)
      .eq('user_id', uid)
      .or(`is_active.eq.1,depleted_at.gte.${cutoff}`)
      .order('is_active', { ascending: false })
      .order('reconstituted_at', { ascending: false })
  ) ?? []) as Vial[];
}

export async function getVialsForCycle(cycle_id: string): Promise<Vial[]> {
  const uid = requireUserId();
  return (must(
    await sb()
      .from('vials')
      .select('*')
      .eq('cycle_id', cycle_id)
      .eq('user_id', uid)
      .order('reconstituted_at', { ascending: false })
  ) ?? []) as Vial[];
}

export async function attachVialToCycle(vial_id: string, cycle_id: string): Promise<void> {
  const uid = requireUserId();
  must(await sb().from('vials').update({ cycle_id }).eq('id', vial_id).eq('user_id', uid));
}

export async function detachVial(vial_id: string): Promise<void> {
  const uid = requireUserId();
  must(await sb().from('vials').update({ cycle_id: null }).eq('id', vial_id).eq('user_id', uid));
}

export async function countUnattachedActiveVials(peptide_id: string): Promise<number> {
  const uid = requireUserId();
  const res = await sb()
    .from('vials')
    .select('id', { count: 'exact', head: true })
    .eq('peptide_id', peptide_id)
    .eq('user_id', uid)
    .is('cycle_id', null)
    .eq('is_active', 1);
  if (res.error) throw new Error(res.error.message);
  return res.count ?? 0;
}

export async function getDosesForVial(vialId: string): Promise<Dose[]> {
  const uid = requireUserId();
  return (must(
    await sb()
      .from('doses')
      .select('*')
      .eq('vial_id', vialId)
      .eq('user_id', uid)
      .order('taken_at', { ascending: false })
  ) ?? []) as Dose[];
}

export async function updateVial(
  id: string,
  patch: {
    strength_mg?: number;
    bac_water_ml?: number;
    expires_at?: string | null;
    notes?: string | null;
    cost_usd?: number | null;
  }
): Promise<void> {
  const uid = requireUserId();
  const current = await getVial(id);
  if (!current) return;

  const newStrength = patch.strength_mg ?? current.strength_mg;
  const newBac = patch.bac_water_ml ?? current.bac_water_ml;
  const recomputeConc =
    newStrength !== current.strength_mg || newBac !== current.bac_water_ml;

  const out: Record<string, unknown> = {
    strength_mg: newStrength,
    bac_water_ml: newBac,
  };
  if (recomputeConc) out.concentration = newStrength / newBac;

  if (patch.strength_mg !== undefined && patch.strength_mg !== current.strength_mg) {
    // Recompute remaining_mg from dose history: strength − sum(drawn).
    const doses = (must(
      await sb().from('doses').select('amount_mcg').eq('vial_id', id).eq('user_id', uid)
    ) ?? []) as { amount_mcg: number }[];
    const drawnMg = doses.reduce((s, d) => s + d.amount_mcg, 0) / 1000;
    out.remaining_mg = Math.max(0, newStrength - drawnMg);
  }
  if (patch.expires_at !== undefined) out.expires_at = patch.expires_at;
  if (patch.notes !== undefined) out.notes = patch.notes;
  if (patch.cost_usd !== undefined) out.cost_usd = patch.cost_usd;

  must(await sb().from('vials').update(out).eq('id', id).eq('user_id', uid));
}

// ---- Doses -----------------------------------------------------------------

export async function getDoseById(id: string): Promise<Dose | null> {
  const uid = requireUserId();
  return (must(
    await sb().from('doses').select('*').eq('id', id).eq('user_id', uid).maybeSingle()
  ) as Dose | null);
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
): Promise<void> {
  const uid = requireUserId();
  const current = await getDoseById(id);
  if (!current) return;

  const out: Record<string, unknown> = {};
  if (patch.amount_mcg !== undefined) out.amount_mcg = patch.amount_mcg;
  if (patch.route !== undefined) out.route = patch.route;
  if (patch.site !== undefined) out.site = patch.site;
  if (patch.note !== undefined) out.note = patch.note;
  if (patch.taken_at !== undefined) out.taken_at = patch.taken_at;
  if (Object.keys(out).length === 0) return;

  must(await sb().from('doses').update(out).eq('id', id).eq('user_id', uid));

  // Adjust the source vial's remaining_mg by the dose delta.
  if (patch.amount_mcg !== undefined && current.vial_id) {
    const deltaMg = (patch.amount_mcg - current.amount_mcg) / 1000;
    const vial = await getVial(current.vial_id);
    if (vial) {
      must(
        await sb()
          .from('vials')
          .update({ remaining_mg: Math.max(0, vial.remaining_mg - deltaMg) })
          .eq('id', current.vial_id)
          .eq('user_id', uid)
      );
    }
  }

  // Re-sync the injection-site log row for this dose.
  if (patch.site !== undefined || patch.taken_at !== undefined) {
    must(await sb().from('injection_sites_log').delete().eq('dose_id', id).eq('user_id', uid));
    if (patch.site) {
      must(
        await sb().from('injection_sites_log').insert({
          id: genId('site'),
          user_id: uid,
          site: patch.site,
          used_at: patch.taken_at ?? current.taken_at,
          dose_id: id,
        })
      );
    }
  }
}

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

  // Auto-pick the active vial closest to expiry when none supplied.
  let vial_id: string | null = input.vial_id ?? null;
  if (vial_id === null) {
    const auto = (must(
      await sb()
        .from('vials')
        .select('id')
        .eq('peptide_id', input.peptide_id)
        .eq('is_active', 1)
        .eq('user_id', uid)
        .order('expires_at', { ascending: true, nullsFirst: false })
        .order('reconstituted_at', { ascending: true })
        .limit(1)
        .maybeSingle()
    ) as { id: string } | null);
    if (auto) vial_id = auto.id;
  }

  // Auto-attach to the active cycle covering this peptide when none supplied.
  let cycle_id: string | null = input.cycle_id ?? null;
  if (cycle_id === null) {
    const cov = await getActiveCycleForPeptide(input.peptide_id);
    if (cov) cycle_id = cov.id;
  }

  must(
    await sb().from('doses').insert({
      id,
      user_id: uid,
      peptide_id: input.peptide_id,
      vial_id,
      cycle_id,
      amount_mcg: input.amount_mcg,
      volume_units: input.volume_units ?? null,
      route: input.route,
      site: input.site ?? null,
      taken_at,
      note: input.note ?? null,
    })
  );

  if (vial_id) {
    const vial = await getVial(vial_id);
    if (vial) {
      must(
        await sb()
          .from('vials')
          .update({
            remaining_mg: Math.max(0, vial.remaining_mg - amount_mg),
            total_doses_drawn: vial.total_doses_drawn + 1,
            first_used_at: vial.first_used_at ?? taken_at,
          })
          .eq('id', vial_id)
          .eq('user_id', uid)
      );
    }
  }

  if (input.site) {
    must(
      await sb().from('injection_sites_log').insert({
        id: genId('site'),
        user_id: uid,
        site: input.site,
        used_at: taken_at,
        dose_id: id,
      })
    );
  }
  return id;
}

export async function listDoses(
  opts: { limit?: number; from?: string; to?: string } = {}
): Promise<Dose[]> {
  const uid = requireUserId();
  const { limit = 50, from, to } = opts;
  let q = sb().from('doses').select('*').eq('user_id', uid);
  if (from) q = q.gte('taken_at', from);
  if (to) q = q.lte('taken_at', to);
  return (must(await q.order('taken_at', { ascending: false }).limit(limit)) ?? []) as Dose[];
}

export async function getLastDoseForCyclePeptide(
  cycle_id: string,
  peptide_id: string
): Promise<Dose | null> {
  const uid = requireUserId();
  return (must(
    await sb()
      .from('doses')
      .select('*')
      .eq('cycle_id', cycle_id)
      .eq('peptide_id', peptide_id)
      .eq('user_id', uid)
      .order('taken_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ) as Dose | null);
}

export async function deleteDose(id: string): Promise<void> {
  const uid = requireUserId();
  const dose = await getDoseById(id);
  if (!dose) return;
  // Return the drawn amount to the source vial.
  if (dose.vial_id) {
    const vial = await getVial(dose.vial_id);
    if (vial) {
      must(
        await sb()
          .from('vials')
          .update({ remaining_mg: vial.remaining_mg + dose.amount_mcg / 1000 })
          .eq('id', dose.vial_id)
          .eq('user_id', uid)
      );
    }
  }
  must(await sb().from('injection_sites_log').delete().eq('dose_id', id).eq('user_id', uid));
  must(await sb().from('doses').delete().eq('id', id).eq('user_id', uid));
}

// ---- Cycles ----------------------------------------------------------------

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
  must(
    await sb().from('cycles').insert({
      id,
      user_id: uid,
      name: input.name,
      starts_on: input.starts_on,
      ends_on: input.ends_on,
      phase: input.phase ?? 'active',
      status: 'active',
      stack_id: input.stack_id ?? null,
      protocol_json: JSON.stringify(input.protocol),
      notes: input.notes ?? null,
    })
  );
  return id;
}

export async function getActiveCycle(): Promise<Cycle | null> {
  const uid = requireUserId();
  return (must(
    await sb()
      .from('cycles')
      .select('*')
      .eq('status', 'active')
      .eq('user_id', uid)
      .order('starts_on', { ascending: false })
      .limit(1)
      .maybeSingle()
  ) as Cycle | null);
}

export async function listActiveCycles(): Promise<Cycle[]> {
  const uid = requireUserId();
  return (must(
    await sb()
      .from('cycles')
      .select('*')
      .in('status', ['active', 'paused'])
      .eq('user_id', uid)
      .order('starts_on', { ascending: false })
  ) ?? []) as Cycle[];
}

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

export async function getActiveCycleForPeptide(peptideId: string): Promise<Cycle | null> {
  return (await listActiveCyclesForPeptide(peptideId))[0] ?? null;
}

export async function listCycles(): Promise<Cycle[]> {
  const uid = requireUserId();
  return (must(
    await sb()
      .from('cycles')
      .select('*')
      .eq('user_id', uid)
      .order('starts_on', { ascending: false })
  ) ?? []) as Cycle[];
}

export async function endCycle(id: string): Promise<void> {
  const uid = requireUserId();
  must(await sb().from('cycles').update({ status: 'complete' }).eq('id', id).eq('user_id', uid));
  // Return attached vials to free inventory; per-dose cycle_id is retained.
  must(await sb().from('vials').update({ cycle_id: null }).eq('cycle_id', id).eq('user_id', uid));
}

export async function pauseCycle(id: string): Promise<void> {
  const uid = requireUserId();
  must(
    await sb()
      .from('cycles')
      .update({ status: 'paused', paused_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', uid)
  );
}

export async function resumeCycle(id: string): Promise<void> {
  const uid = requireUserId();
  const row = (must(
    await sb().from('cycles').select('*').eq('id', id).eq('user_id', uid).maybeSingle()
  ) as Cycle | null);
  if (!row || !row.paused_at) return;
  const pausedMs = Date.now() - new Date(row.paused_at).getTime();
  const pausedDays = Math.max(0, Math.round(pausedMs / 864e5));
  const endsOn = new Date(row.ends_on);
  endsOn.setDate(endsOn.getDate() + pausedDays);
  const newEnds = endsOn.toISOString().slice(0, 10);
  must(
    await sb()
      .from('cycles')
      .update({
        status: 'active',
        paused_at: null,
        paused_total_days: row.paused_total_days + pausedDays,
        ends_on: newEnds,
      })
      .eq('id', id)
      .eq('user_id', uid)
  );
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
): Promise<void> {
  const uid = requireUserId();
  const out: Record<string, unknown> = {};
  if (patch.name !== undefined) out.name = patch.name;
  if (patch.starts_on !== undefined) out.starts_on = patch.starts_on;
  if (patch.ends_on !== undefined) out.ends_on = patch.ends_on;
  if (patch.phase !== undefined) out.phase = patch.phase;
  if (patch.status !== undefined) out.status = patch.status;
  if (patch.protocol !== undefined) out.protocol_json = JSON.stringify(patch.protocol);
  if (patch.notes !== undefined) out.notes = patch.notes;
  if (Object.keys(out).length === 0) return;
  must(await sb().from('cycles').update(out).eq('id', id).eq('user_id', uid));
}

// ---- Dose skips ------------------------------------------------------------

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
  must(
    await sb().from('dose_skips').insert({
      id,
      user_id: uid,
      peptide_id: input.peptide_id,
      cycle_id: input.cycle_id ?? null,
      scheduled_date: input.scheduled_date,
      time_of_day: input.time_of_day ?? null,
      reason: input.reason ?? null,
      note: input.note ?? null,
    })
  );
  return id;
}

export async function listDoseSkips(
  opts: { from?: string; to?: string; cycle_id?: string } = {}
): Promise<DoseSkip[]> {
  const uid = requireUserId();
  let q = sb().from('dose_skips').select('*').eq('user_id', uid);
  if (opts.from) q = q.gte('scheduled_date', opts.from);
  if (opts.to) q = q.lte('scheduled_date', opts.to);
  if (opts.cycle_id) q = q.eq('cycle_id', opts.cycle_id);
  return (must(await q.order('scheduled_date', { ascending: false })) ?? []) as DoseSkip[];
}

export async function deleteDoseSkip(id: string): Promise<void> {
  const uid = requireUserId();
  must(await sb().from('dose_skips').delete().eq('id', id).eq('user_id', uid));
}

// ---- Stacks ----------------------------------------------------------------

export async function createStack(input: {
  name: string;
  goal?: string;
  items: StackItem[];
  synergy_score?: number;
}): Promise<string> {
  const uid = requireUserId();
  const id = genId('stack');
  must(
    await sb().from('stacks').insert({
      id,
      user_id: uid,
      name: input.name,
      goal: input.goal ?? null,
      items_json: JSON.stringify(input.items),
      synergy_score: input.synergy_score ?? null,
    })
  );
  return id;
}

export async function listStacks(): Promise<Stack[]> {
  const uid = requireUserId();
  return (must(
    await sb()
      .from('stacks')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
  ) ?? []) as Stack[];
}

export async function getStack(id: string): Promise<Stack | null> {
  const uid = requireUserId();
  return (must(
    await sb().from('stacks').select('*').eq('id', id).eq('user_id', uid).maybeSingle()
  ) as Stack | null);
}

export async function deleteStack(id: string): Promise<void> {
  const uid = requireUserId();
  must(await sb().from('stacks').delete().eq('id', id).eq('user_id', uid));
}

// ---- Journal ---------------------------------------------------------------

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
}): Promise<string> {
  const uid = requireUserId();
  const existing = (must(
    await sb()
      .from('journal_entries')
      .select('*')
      .eq('entry_date', input.entry_date)
      .eq('user_id', uid)
      .maybeSingle()
  ) as JournalEntry | null);

  const id = existing?.id ?? genId('jrnl');
  const row = {
    id,
    user_id: uid,
    entry_date: input.entry_date,
    mood: input.mood ?? existing?.mood ?? null,
    energy: input.energy ?? existing?.energy ?? null,
    sleep_hours: input.sleep_hours ?? existing?.sleep_hours ?? null,
    sleep_quality: input.sleep_quality ?? existing?.sleep_quality ?? null,
    libido: input.libido ?? existing?.libido ?? null,
    recovery: input.recovery ?? existing?.recovery ?? null,
    tags_json: JSON.stringify(
      input.tags ?? (existing ? JSON.parse(existing.tags_json || '[]') : [])
    ),
    body: input.body ?? existing?.body ?? null,
    updated_at: new Date().toISOString(),
  };
  must(await sb().from('journal_entries').upsert(row, { onConflict: 'user_id,entry_date' }));
  return id;
}

export async function getJournal(entry_date: string): Promise<JournalEntry | null> {
  const uid = requireUserId();
  return (must(
    await sb()
      .from('journal_entries')
      .select('*')
      .eq('entry_date', entry_date)
      .eq('user_id', uid)
      .maybeSingle()
  ) as JournalEntry | null);
}

export async function listJournal(limit = 30): Promise<JournalEntry[]> {
  const uid = requireUserId();
  return (must(
    await sb()
      .from('journal_entries')
      .select('*')
      .eq('user_id', uid)
      .order('entry_date', { ascending: false })
      .limit(limit)
  ) ?? []) as JournalEntry[];
}

// ---- Metrics ---------------------------------------------------------------

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
  must(
    await sb().from('metrics').insert({
      id,
      user_id: uid,
      kind: input.kind,
      value: input.value,
      unit: input.unit ?? kind_info?.unit ?? null,
      taken_at: input.taken_at ?? new Date().toISOString(),
      source: 'manual',
      note: input.note ?? null,
    })
  );
  return id;
}

export async function listMetrics(kind: string, limit = 90): Promise<Metric[]> {
  const uid = requireUserId();
  return (must(
    await sb()
      .from('metrics')
      .select('*')
      .eq('kind', kind)
      .eq('user_id', uid)
      .order('taken_at', { ascending: false })
      .limit(limit)
  ) ?? []) as Metric[];
}

export async function listAllMetricKindsWithLatest(): Promise<
  { kind: string; latest: Metric | null }[]
> {
  const uid = requireUserId();
  const out: { kind: string; latest: Metric | null }[] = [];
  for (const k of METRIC_KINDS) {
    const latest = (must(
      await sb()
        .from('metrics')
        .select('*')
        .eq('kind', k.id)
        .eq('user_id', uid)
        .order('taken_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ) as Metric | null);
    out.push({ kind: k.id, latest });
  }
  return out;
}

export async function deleteMetric(id: string): Promise<void> {
  const uid = requireUserId();
  must(await sb().from('metrics').delete().eq('id', id).eq('user_id', uid));
}

// ---- Injection-site rotation -----------------------------------------------

type SiteLogWithDose = {
  site: string;
  used_at: string;
  doses: { route: string | null } | { route: string | null }[] | null;
};

function routeOf(row: SiteLogWithDose): string | null {
  const d = row.doses;
  if (!d) return null;
  return Array.isArray(d) ? (d[0]?.route ?? null) : d.route;
}

function isInjectionRoute(route: string | null): boolean {
  return route === null || route === 'SubQ' || route === 'IM';
}

async function siteHistory(): Promise<Map<string, { last_used: string; uses: number }>> {
  const uid = requireUserId();
  const rows = (must(
    await sb()
      .from('injection_sites_log')
      .select('site, used_at, doses(route)')
      .eq('user_id', uid)
  ) ?? []) as SiteLogWithDose[];
  const map = new Map<string, { last_used: string; uses: number }>();
  for (const r of rows) {
    if (!isInjectionRoute(routeOf(r))) continue;
    const cur = map.get(r.site);
    if (!cur) {
      map.set(r.site, { last_used: r.used_at, uses: 1 });
    } else {
      cur.uses += 1;
      if (r.used_at > cur.last_used) cur.last_used = r.used_at;
    }
  }
  return map;
}

export async function siteSuggestion(): Promise<SiteSuggestion> {
  const now = Date.now();
  const map = await siteHistory();
  const scored: SiteSuggestion[] = INJECTION_SITES.map((site) => {
    const h = map.get(site);
    return {
      site,
      days_since: h ? Math.floor((now - new Date(h.last_used).getTime()) / 864e5) : 999,
      total_uses: h?.uses ?? 0,
      last_used: h?.last_used ?? null,
    };
  });
  scored.sort((a, b) => b.days_since - a.days_since || a.total_uses - b.total_uses);
  return scored[0];
}

export async function siteRecency(): Promise<SiteSuggestion[]> {
  const now = Date.now();
  const map = await siteHistory();
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

export async function listDosesAtSite(site: string, limit = 10): Promise<Dose[]> {
  const uid = requireUserId();
  const rows = (must(
    await sb()
      .from('injection_sites_log')
      .select('used_at, doses(*)')
      .eq('site', site)
      .eq('user_id', uid)
      .order('used_at', { ascending: false })
  ) ?? []) as { doses: Dose | Dose[] | null }[];
  const doses: Dose[] = [];
  for (const r of rows) {
    const d = Array.isArray(r.doses) ? r.doses[0] : r.doses;
    if (d && isInjectionRoute(d.route)) doses.push(d);
  }
  doses.sort((a, b) => (a.taken_at < b.taken_at ? 1 : -1));
  return doses.slice(0, limit);
}

// ---- Export ----------------------------------------------------------------

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
  return {
    profile: await getProfile(),
    cycles: await listCycles(),
    doses: (must(
      await sb()
        .from('doses')
        .select('*')
        .eq('user_id', uid)
        .order('taken_at', { ascending: false })
    ) ?? []) as Dose[],
    vials: (must(
      await sb()
        .from('vials')
        .select('*')
        .eq('user_id', uid)
        .order('reconstituted_at', { ascending: false })
    ) ?? []) as Vial[],
    stacks: await listStacks(),
    metrics: (must(
      await sb()
        .from('metrics')
        .select('*')
        .eq('user_id', uid)
        .order('taken_at', { ascending: false })
    ) ?? []) as Metric[],
    journal: await listJournal(1000),
    dose_skips: await listDoseSkips({}),
    saved_peptides: await listSavedPeptides(),
    exported_at: new Date().toISOString(),
    schema_version: SCHEMA_VERSION,
  };
}

export const exportAll = exportAllData;

// Wipes the current user's rows across every user-data table, then resets
// the per-device profile acceptances. Mirrors the auth-mode branch of the
// native deleteAllUserData (there is no legacy local-only mode on web).
export async function deleteAllUserData(): Promise<void> {
  const uid = getCurrentUserId();
  if (!uid) return;
  const client = sb();
  for (const t of [
    'doses',
    'vials',
    'cycles',
    'stacks',
    'journal_entries',
    'metrics',
    'injection_sites_log',
    'saved_peptides',
    'dose_skips',
  ]) {
    must(await client.from(t).delete().eq('user_id', uid));
  }
  must(
    await client
      .from('profiles')
      .update({
        display_name: null,
        birth_year: null,
        onboarding_done: false,
        terms_accepted_at: null,
        age_confirmed_at: null,
        disclaimer_accepted_at: null,
        local_data_attributed_at: null,
      })
      .eq('user_id', uid)
  );
}

// ---- Phase C: data attribution (native-only) ------------------------------
//
// These power the "Keep your local data?" prompt on native, which migrates
// pre-auth NULL-user_id SQLite rows. On web there is no local SQLite and no
// pre-auth data — all data is already user-scoped in Supabase — so these are
// inert: nothing to detect, count, attribute, or discard.

export async function hasLegacyLocalData(): Promise<boolean> {
  return false;
}

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
  return {
    doses: 0,
    vials: 0,
    cycles: 0,
    stacks: 0,
    journal: 0,
    metrics: 0,
    sites: 0,
    saved: 0,
    skips: 0,
  };
}

export async function attributeLocalDataToUser(_userId: string): Promise<void> {
  return;
}

export async function discardLegacyLocalData(): Promise<void> {
  return;
}
