// Cross-cutting helpers for cycle ↔ vial ↔ dose relationships. Pulled out
// of cycle/[id].tsx and reconstitute.tsx so the same logic powers the
// vial-needed banner, the next-injection countdown, and the reconstitute
// prioritization. Pure data — no JSX, no theming.

import { getActiveVial, getLastDoseForCyclePeptide, listCycles } from './db';
import type { Cycle, CycleProtocolItem } from './db';
import { describeFreq } from './freq';
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
  for (const item of items) {
    if (seen.has(item.peptide_id)) continue;
    seen.add(item.peptide_id);

    const shape = describeFreq(item.freq);
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
