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

export type CycleTemplate = {
  duration_weeks: number;
  phase_notes: string;
  schedule: string;
};

export type PeptideExtras = {
  benefits: string;
  beginnerProtocol: string;
  cycleTemplate: CycleTemplate;
  timing: string;
  coAdministration: CoAdmin[];
  stackConflicts: StackConflict[];
};

export type PeptideExtrasMap = Record<string, PeptideExtras>;
