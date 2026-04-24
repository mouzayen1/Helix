// Per-peptide extras — research-sourced only. Spec §15 compliance.
// Keep each entry tight and honest. Never invent mechanisms or numbers.

export type CoAdmin = {
  peptide_id: string;
  note: string;
  co_reconstitute?: boolean;
};

export type StackConflict = {
  peptide_id: string;
  reason: string;
};

// Optional structured phases array — lets peptides like TB-500 describe
// a loading→maintenance protocol that renders as distinct phase cards.
// Each phase has a name, duration, and optional dose_modifier string
// (e.g. '3 mg SubQ 2× weekly' for loading).
export type CyclePhase = {
  name: string;
  weeks: number;
  dose_modifier?: string;
};

export type CycleTemplate = {
  duration_weeks: number;
  phase_notes: string;
  schedule: string;
  phases?: CyclePhase[];
};

export type PeptideExtras = {
  benefits: string;
  beginnerProtocol: string;
  cycleTemplate: CycleTemplate;
  timing: string;
  coAdministration: CoAdmin[];
  stackConflicts: StackConflict[];
  /** Common mistakes researchers make with this compound.
   *  Clinical, factual — no bro-science. */
  commonMistakes?: string[];
  /** Practical research-context tips (e.g. reconstitution quirks, injection timing). */
  proTips?: string[];
};

export type PeptideExtrasMap = Record<string, PeptideExtras>;
