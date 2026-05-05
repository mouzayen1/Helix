// Dose unit display + input parsing.
//
// Storage contract: dose_mcg / amount_mcg are ALWAYS stored as mcg.
// This module is purely a display + input-boundary helper. It never
// writes to the DB or mutates dose values; it only converts numbers
// to display strings and parses user input back to canonical mcg.
//
// Vial-level mg fields (strength_mg, remaining_mg, concentration mg/mL)
// are intrinsic mg quantities — they are NOT routed through this helper.

export type DoseUnit = 'mcg' | 'mg';
export type DoseUnitPref = 'auto' | DoseUnit;

const AUTO_MG_THRESHOLD_MCG = 1000;

/**
 * Resolve which unit a given mcg value should display in given the user's pref.
 * 'auto' switches to mg at mcg >= 1000.
 */
export function resolveDoseUnit(mcg: number, pref: DoseUnitPref): DoseUnit {
  if (pref === 'mcg' || pref === 'mg') return pref;
  return mcg >= AUTO_MG_THRESHOLD_MCG ? 'mg' : 'mcg';
}

/**
 * Format a stored mcg value as a display { value, unit } pair.
 * - mcg unit: integer-rounded (250 mcg, not 250.0 mcg)
 * - mg unit: up to 3 decimals, trailing zeros trimmed (2 mg, 1.75 mg, 0.25 mg)
 */
export function formatDose(
  mcg: number,
  pref: DoseUnitPref = 'auto',
): { value: string; unit: DoseUnit } {
  if (!Number.isFinite(mcg)) return { value: '0', unit: 'mcg' };
  const unit = resolveDoseUnit(mcg, pref);
  if (unit === 'mcg') {
    return { value: String(Math.round(mcg)), unit: 'mcg' };
  }
  const mg = mcg / 1000;
  return { value: trimZeros(mg.toFixed(3)), unit: 'mg' };
}

/** Convenience: pre-joined "VALUE UNIT" string. */
export function formatDoseLabel(mcg: number, pref: DoseUnitPref = 'auto'): string {
  const { value, unit } = formatDose(mcg, pref);
  return `${value} ${unit}`;
}

/**
 * Parse user-typed input back to mcg. The caller specifies which unit
 * the user is currently typing in (the input chip's mode).
 * Empty / NaN input returns null so callers can keep the previous value.
 */
export function parseDoseInput(text: string, mode: DoseUnit): number | null {
  const cleaned = text.trim().replace(/,/g, '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return mode === 'mg' ? Math.round(n * 1000) : Math.round(n);
}

/**
 * Cycle the global preference: auto → mcg → mg → auto.
 */
export function cycleDoseUnitPref(pref: DoseUnitPref): DoseUnitPref {
  if (pref === 'auto') return 'mcg';
  if (pref === 'mcg') return 'mg';
  return 'auto';
}

/** Short label describing a pref ("AUTO", "MCG", "MG"). */
export function doseUnitPrefLabel(pref: DoseUnitPref): string {
  return pref.toUpperCase();
}

/**
 * Step size for a dose stepper given the current unit. Keeps stepping
 * sensible whether the user is in mcg mode (50/100/250 mcg jumps) or
 * mg mode (0.05/0.1/0.25 mg jumps).
 */
export function doseStep(currentMcg: number, unit: DoseUnit): number {
  if (unit === 'mg') {
    if (currentMcg < 500) return 50;
    if (currentMcg < 2000) return 100;
    return 250;
  }
  if (currentMcg < 200) return 25;
  if (currentMcg < 1000) return 50;
  if (currentMcg < 5000) return 100;
  return 250;
}

function trimZeros(s: string): string {
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '');
}
