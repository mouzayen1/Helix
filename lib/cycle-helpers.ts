// Cross-cutting helpers for cycle ↔ vial ↔ dose relationships. Pulled out
// of cycle/[id].tsx and reconstitute.tsx so the same logic powers the
// vial-needed banner, the next-injection countdown, and the reconstitute
// prioritization. Pure data — no JSX, no theming.
//
// ── Phase indexing convention (locked) ────────────────────────────────────
//   • startWeek is 1-INDEXED. Humans read "starts at week 9".
//   • dayOfCycle is 0-INDEXED. Day 0 = first day of the cycle.
//   • currentWeek = Math.floor(dayOfCycle / 7) + 1. Day 0 → week 1,
//     day 56 → week 9.
//   • A phase with startWeek = 9 begins at dayOfCycle = (9 - 1) * 7 = 56.
//
// 5-on/2-off boundary semantics: the on/off window counts from the phase's
// start day, NOT a calendar week. If a phase begins on a Wednesday, the
// first on-window runs Wed–Sun. (See lib/freq.ts isScheduledOnDay.)

import { getActiveVial, getLastDoseForCyclePeptide, listActiveCycles, listCycles } from './db';
import type { Cycle, CycleProtocolItem, CycleProtocolItemPhase } from './db';
import { describeFreq, isScheduledOnDay } from './freq';
import { PEPTIDES } from './peptides';

const peptideName = (id: string) => PEPTIDES.find((p) => p.id === id)?.name ?? id;

function parseProtocol(cycle: Cycle): CycleProtocolItem[] {
  if (!cycle.protocol_json) return [];
  try {
    const parsed = JSON.parse(cycle.protocol_json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Phase resolver ───────────────────────────────────────────────────────
// resolvePhase + isItemScheduledOnDay are the single source of truth for
// "what's active for this peptide on this day of the cycle." Three
// consumers (Today schedule, notifications, next-injection) flow through
// these so phase boundaries, dose ramps, and N-on/M-off windows stay
// consistent. See top-of-file comment for the indexing convention.

export type ResolvedPhase = {
  freq: string;
  dose_mcg: number;
  phaseName?: string;
  phaseIndex: number;       // 0 when no phases declared
  weekInPhase: number;      // 1-indexed
  totalPhaseWeeks: number;  // Infinity for the open-ended last phase
  phaseCount: number;       // 1 when phases is absent / single-element
  phaseStartDay: number;    // 0-indexed day of cycle this phase began
};

export function resolvePhase(
  item: CycleProtocolItem,
  dayOfCycle: number,
): ResolvedPhase {
  const day = Math.max(0, Math.floor(dayOfCycle));
  const currentWeek = Math.floor(day / 7) + 1; // 1-indexed
  const phases = (item.phases ?? []).slice().sort((a, b) => a.startWeek - b.startWeek);

  if (phases.length < 2) {
    return {
      freq: item.freq,
      dose_mcg: item.dose_mcg,
      phaseIndex: 0,
      weekInPhase: currentWeek,
      totalPhaseWeeks: Infinity,
      phaseCount: phases.length === 1 ? 1 : 1,
      phaseStartDay: 0,
    };
  }

  // Pick the latest phase whose startWeek <= currentWeek. If we're before
  // the first phase's startWeek (e.g. user entered phases starting at week
  // 2 with no week-1 phase) fall back to the first phase — most users mean
  // "phase 1 covers everything before the next boundary."
  let activeIdx = 0;
  for (let i = 0; i < phases.length; i++) {
    if (phases[i].startWeek <= currentWeek) activeIdx = i;
  }
  const active = phases[activeIdx];
  const next = phases[activeIdx + 1];
  const phaseStartDay = (active.startWeek - 1) * 7;
  const totalPhaseWeeks = next ? next.startWeek - active.startWeek : Infinity;
  const weekInPhase = Math.max(1, currentWeek - active.startWeek + 1);

  return {
    freq: active.freq,
    dose_mcg: active.dose_mcg ?? item.dose_mcg,
    phaseName: active.name,
    phaseIndex: activeIdx,
    weekInPhase,
    totalPhaseWeeks,
    phaseCount: phases.length,
    phaseStartDay,
  };
}

/** Is this protocol item scheduled to dose on this 0-indexed day of cycle?
 *  Routes through the phase-active freq, and resets N-on/M-off windows at
 *  each phase boundary by passing (dayOfCycle - phaseStartDay) into
 *  isScheduledOnDay. */
export function isItemScheduledOnDay(
  item: CycleProtocolItem,
  dayOfCycle: number,
): boolean {
  const rp = resolvePhase(item, dayOfCycle);
  return isScheduledOnDay(rp.freq, dayOfCycle - rp.phaseStartDay);
}

/** Helper to coerce a sorted+validated phases array. The wizard editor
 *  uses this when persisting so on-disk data is canonical. */
export function sortPhases(phases: CycleProtocolItemPhase[]): CycleProtocolItemPhase[] {
  return phases.slice().sort((a, b) => a.startWeek - b.startWeek);
}

export type VialNeed = {
  peptide_id: string;
  peptide_name: string;
  has_active_vial: boolean;
};

/** For each protocol item, whether an active vial exists with remaining mg.
 *  De-dupes by peptide_id so a peptide listed twice in a protocol shows once.  */
export async function getVialsNeededForCycle(cycleId: string): Promise<VialNeed[]> {
  const cycles = await listCycles();
  const cycle = cycles.find((c) => c.id === cycleId);
  if (!cycle) return [];
  const items = parseProtocol(cycle);
  const seen = new Set<string>();
  const out: VialNeed[] = [];
  for (const item of items) {
    if (seen.has(item.peptide_id)) continue;
    seen.add(item.peptide_id);
    const vial = await getActiveVial(item.peptide_id);
    out.push({
      peptide_id: item.peptide_id,
      peptide_name: peptideName(item.peptide_id),
      has_active_vial: !!vial && vial.remaining_mg > 0,
    });
  }
  return out;
}

export type NextInjectionState =
  | 'pending_first_dose'
  | 'scheduled'
  | 'overdue'
  | 'prn';

export type NextInjection = {
  peptide_id: string;
  peptide_name: string;
  state: NextInjectionState;
  /** ISO; only set when state === 'scheduled' | 'overdue'. */
  due_at?: string;
};

/** Computes the next-due dose for each protocol item using the LAST logged
 *  dose + describeFreq().daysPerDose. Edge cases handled inside, never NaN:
 *  - no dose logged yet           → state: 'pending_first_dose'
 *  - PRN / as-needed / blank freq → state: 'prn'  (caller hides these)
 *  - last_dose + interval < now    → state: 'overdue'
 *  - else                          → state: 'scheduled' */
export async function getNextInjectionForCycle(cycleId: string): Promise<NextInjection[]> {
  const cycles = await listCycles();
  const cycle = cycles.find((c) => c.id === cycleId);
  if (!cycle) return [];
  const items = parseProtocol(cycle);

  const out: NextInjection[] = [];
  const seen = new Set<string>();
  // dayOfCycle matches Today screen + notifications: Math.floor((today -
  // starts_on) / day-ms), no paused-day subtraction.
  const startMs = new Date(cycle.starts_on).getTime();
  const dayOfCycle = Math.max(0, Math.floor((Date.now() - startMs) / 86_400_000));

  for (const item of items) {
    if (seen.has(item.peptide_id)) continue;
    seen.add(item.peptide_id);

    const rp = resolvePhase(item, dayOfCycle);
    const shape = describeFreq(rp.freq);
    const isPrn = shape.daysPerDose <= 0 || shape.label === 'as-needed';
    if (isPrn) {
      out.push({
        peptide_id: item.peptide_id,
        peptide_name: peptideName(item.peptide_id),
        state: 'prn',
      });
      continue;
    }

    const last = await getLastDoseForCyclePeptide(cycleId, item.peptide_id);

    if (!last) {
      out.push({
        peptide_id: item.peptide_id,
        peptide_name: peptideName(item.peptide_id),
        state: 'pending_first_dose',
      });
      continue;
    }

    const due = new Date(new Date(last.taken_at).getTime() + shape.daysPerDose * 86_400_000);
    out.push({
      peptide_id: item.peptide_id,
      peptide_name: peptideName(item.peptide_id),
      state: due.getTime() < Date.now() ? 'overdue' : 'scheduled',
      due_at: due.toISOString(),
    });
  }
  return out;
}

/** All peptide IDs across every active cycle's protocol, deduped.
 *  Used by the reconstitute screen to pin "needed" peptides at the top. */
export async function getActiveCyclePeptideIds(): Promise<Set<string>> {
  const cycles = await listCycles();
  const ids = new Set<string>();
  for (const c of cycles) {
    if (c.status !== 'active') continue;
    for (const item of parseProtocol(c)) ids.add(item.peptide_id);
  }
  return ids;
}

/** Map peptide_id → first active cycle that includes it. Useful for the
 *  reconstitute picker subtitle: "NEEDED for: {cycle name}". */
export async function getActiveCyclesByPeptide(): Promise<Map<string, Cycle>> {
  const cycles = await listCycles();
  const out = new Map<string, Cycle>();
  for (const c of cycles) {
    if (c.status !== 'active') continue;
    for (const item of parseProtocol(c)) {
      if (!out.has(item.peptide_id)) out.set(item.peptide_id, c);
    }
  }
  return out;
}

/** Format an ISO timestamp into a relative "in 3d", "in 6h", "12m ago" string.
 *  Used by the cycle detail header and stacks-card next-injection line. */
export function formatRelativeDue(isoDate: string): string {
  const ms = new Date(isoDate).getTime() - Date.now();
  const abs = Math.abs(ms);
  const min = Math.round(abs / 60_000);
  const hr = Math.round(abs / 3_600_000);
  const day = Math.round(abs / 86_400_000);
  let out: string;
  if (abs < 60 * 60_000) out = `${min}m`;
  else if (abs < 36 * 3_600_000) out = `${hr}h`;
  else out = `${day}d`;
  return ms < 0 ? `${out} ago` : `in ${out}`;
}

// ── Calendar projection ────────────────────────────────────────────────────
// getScheduledDosesInRange expands every active cycle into the concrete
// scheduled doses that fall inside a date window — the data behind the
// in-app calendar's day cells. It walks the same phase resolver +
// isItemScheduledOnDay path as the Today screen and the notification/OS
// calendar schedulers, so phase ramps and N-on/M-off windows stay
// consistent. No freq re-parsing lives here.

// Parse a date-only string as LOCAL midnight. `new Date('YYYY-MM-DD')` parses
// as UTC, which lands on the previous local day in any negative-UTC offset and
// shifts the cycle-day counter. starts_on/ends_on are stored local (see
// app/cycle/new.tsx isoDate), so they must be read back local. Mirrors the
// helper in app/(tabs)/index.tsx — kept private here to avoid a circular import.
function parseLocalDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return new Date(s);
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

// Whole-day delta compared at date granularity (time-of-day stripped) via
// Date.UTC of the local Y/M/D, so DST and timezone offsets can't push a
// same-day pair across a boundary. Same math as the Today screen.
function daysBetween(a: Date, b: Date): number {
  const ms =
    Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
    Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.round(ms / 864e5);
}

function isoLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export type ScheduledDose = {
  date: string; // local YYYY-MM-DD
  peptide_id: string;
  peptide_name: string;
  dose_mcg: number;
  freq: string;
  time_of_day: string;
  cycle_id: string;
  cycle_name: string;
};

/** Project scheduled doses across every ACTIVE cycle for each local day in
 *  [from, to] (inclusive, compared at date granularity).
 *
 *  Bounding is intentional and differs from the Today screen: a dose is
 *  emitted only on days inside the cycle's own window (dayOfCycle in
 *  [0, total]). Today keeps showing an active cycle's schedule past its end
 *  date; a forward-looking calendar should stop at ends_on rather than paint
 *  a stale cycle across future months. Paused cycles dose nothing, matching
 *  the Today schedule and the schedulers. */
export async function getScheduledDosesInRange(from: Date, to: Date): Promise<ScheduledDose[]> {
  const cycles = (await listActiveCycles()).filter((c) => c.status === 'active');
  const out: ScheduledDose[] = [];
  // Normalize the walk bounds to local midnights so the cursor steps cleanly
  // one calendar day at a time regardless of the caller's time-of-day.
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  for (const cycle of cycles) {
    const items = parseProtocol(cycle);
    if (items.length === 0) continue;
    const cycleStart = parseLocalDate(cycle.starts_on);
    const total = Math.max(0, daysBetween(cycleStart, parseLocalDate(cycle.ends_on)));

    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      const day = daysBetween(cycleStart, cursor);
      if (day >= 0 && day <= total) {
        const dateIso = isoLocalDate(cursor);
        for (const item of items) {
          if (!isItemScheduledOnDay(item, day)) continue;
          const rp = resolvePhase(item, day);
          out.push({
            date: dateIso,
            peptide_id: item.peptide_id,
            peptide_name: peptideName(item.peptide_id),
            dose_mcg: rp.dose_mcg,
            freq: rp.freq,
            time_of_day: item.time_of_day,
            cycle_id: cycle.id,
            cycle_name: cycle.name,
          });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return out;
}
