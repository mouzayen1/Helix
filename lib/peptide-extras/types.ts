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

export type PeptideOverviewStorage = {
  /** "Refrigerate at 36-46°F (2-8°C). Stable up to 2 years frozen, 1 year refrigerated." */
  beforeMixing: string;
  /** "Refrigerate. Use within 30 days." */
  afterMixing: string;
  /** Optional handling notes — light/shake/swirl. */
  handling?: string;
};

/**
 * v1.4 plain-language overview block for the Peptide Detail screen.
 *
 * Presence of `whatItDoes` is the per-peptide migration flag: when it
 * exists, the Overview tab renders WHAT IT DOES + SIDE EFFECTS +
 * CONTRAINDICATIONS + STORAGE, and the Research tab strips
 * sideEffects/contraindications (they now live on Overview). When it's
 * absent, both tabs render exactly as v1.3 — every peptide is
 * internally consistent, no half-migrated states.
 */
export type PeptideOverview = {
  /** 80-120 word friendly explanation. Honest about evidence quality. */
  whatItDoes: string;
  storage: PeptideOverviewStorage;
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
  /** Reported side effects from clinical / research literature.
   *  Plain-language bullets; sourced from notes / mechanism / trial data. */
  sideEffects?: string[];
  /** Hard-no situations: pregnancy, family history, active malignancy, etc. */
  contraindications?: string[];
  /** Plain-language Overview tab content. See PeptideOverview docs. */
  overview?: PeptideOverview;
};

export type PeptideExtrasMap = Record<string, PeptideExtras>;
