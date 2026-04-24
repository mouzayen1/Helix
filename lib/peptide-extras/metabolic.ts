import type { PeptideExtrasMap } from './types';

const GLP1_IDS = ['sema', 'tirz', 'reta', 'lira'] as const;

function glp1ConflictsExcept(selfId: string) {
  return GLP1_IDS.filter((id) => id !== selfId).map((id) => ({
    peptide_id: id,
    reason: 'Duplicate GLP-1 receptor agonism — stacking compounds nausea, GI side effects, and hypoglycemia risk.',
  }));
}

export const METABOLIC_EXTRAS: PeptideExtrasMap = {
  sema: {
    benefits:
      'Long-acting GLP-1 agonist (Ozempic®, Wegovy®). FDA-approved for T2D and chronic weight management. Clinical trials show ~15% body-weight reduction at max dose; cardiovascular risk reduction in T2D.',
    beginnerProtocol:
      'Label titration (Wegovy): 0.25 mg weekly × 4, 0.5 mg × 4, 1.0 mg × 4, 1.7 mg × 4, then 2.4 mg maintenance. Increase only if GI side effects tolerable.',
    cycleTemplate: {
      duration_weeks: 68,
      phase_notes: 'Not cycled — long-term use is the norm. Consider maintenance after goal weight.',
      schedule: 'Start 0.25 mg SubQ weekly; titrate monthly per tolerance to 2.4 mg weekly.',
    },
    timing: 'Same day each week. Any time of day; take with or without food.',
    coAdministration: [
      { peptide_id: 'cagri', note: 'CagriSema combination — phase-3 tested; GLP-1 + amylin for greater weight loss.' },
    ],
    stackConflicts: glp1ConflictsExcept('sema'),
  },

  tirz: {
    benefits:
      'Dual GIP/GLP-1 agonist (Mounjaro®, Zepbound®). Clinical trials (SURPASS, SURMOUNT) show ~20% body-weight reduction at max dose; superior A1c reduction vs semaglutide.',
    beginnerProtocol:
      'Label titration: 2.5 mg weekly × 4, then increase by 2.5 mg every 4 weeks up to 15 mg, per tolerance.',
    cycleTemplate: {
      duration_weeks: 72,
      phase_notes: 'Long-term use; no standard cycling.',
      schedule: 'Start 2.5 mg SubQ weekly; titrate every 4 weeks up to 15 mg weekly.',
    },
    timing: 'Same day each week.',
    coAdministration: [],
    stackConflicts: glp1ConflictsExcept('tirz'),
  },

  reta: {
    benefits:
      'Triple GIP/GLP-1/GCG agonist, investigational. Phase-2 trials report ~24% body-weight reduction at 48 weeks — largest seen to date in the class.',
    beginnerProtocol:
      'Trial titration: 2 mg weekly × 4, then step up to 4, 8, 12 mg at 4-week intervals.',
    cycleTemplate: {
      duration_weeks: 48,
      phase_notes: 'Investigational — long-term safety profile still being established.',
      schedule: 'Titrate per trial protocol; max 12 mg weekly.',
    },
    timing: 'Same day each week.',
    coAdministration: [],
    stackConflicts: glp1ConflictsExcept('reta'),
  },

  lira: {
    benefits:
      'Shorter-acting GLP-1 analog (Saxenda®, Victoza®). FDA-approved for T2D and weight management. Clinical weight-loss effect ~5–8%.',
    beginnerProtocol:
      'Label: 0.6 mg daily × 7, then step up 0.6 mg weekly to 3.0 mg daily.',
    cycleTemplate: {
      duration_weeks: 56,
      phase_notes: 'Daily SubQ; typically long-term.',
      schedule: 'Start 0.6 mg daily; titrate weekly to 3.0 mg daily per tolerance.',
    },
    timing: 'Same time each day.',
    coAdministration: [],
    stackConflicts: glp1ConflictsExcept('lira'),
  },

  cagri: {
    benefits:
      'Long-acting amylin analog. Amylin slows gastric emptying and increases satiety. Phase-3 combined with semaglutide ("CagriSema") shows additive weight loss.',
    beginnerProtocol:
      'Trial titration: 0.16 mg weekly × 4, step to 0.3, 0.6, 1.2, 2.4 mg weekly monthly.',
    cycleTemplate: {
      duration_weeks: 68,
      phase_notes: 'Long-term, titrated upward monthly.',
      schedule: 'Match titration of paired GLP-1 (usually semaglutide).',
    },
    timing: 'Same day each week.',
    coAdministration: [
      { peptide_id: 'sema', note: 'CagriSema — the canonical pairing; separate vials, same injection day.' },
    ],
    stackConflicts: [],
  },

  aod: {
    benefits:
      'hGH 176-191 fragment. Marketed for lipolytic / fat-loss effects. Human clinical trials have been mixed and the strongest claims (fat-only loss without GH effects) are not well supported.',
    beginnerProtocol:
      'Research protocols: 250–500 mcg SubQ daily, morning, empty stomach.',
    cycleTemplate: {
      duration_weeks: 12,
      phase_notes: 'Cycled 8–12 weeks on, 4 weeks off.',
      schedule: '300 mcg SubQ morning, 5 days on / 2 off, for 12 weeks.',
    },
    timing: 'Morning, empty stomach, 20–30 minutes before breakfast or pre-cardio.',
    coAdministration: [],
    stackConflicts: [],
  },

  amq: {
    benefits:
      'Oral NNMT inhibitor (small molecule, not a peptide). Research on adipose NAD+ / methylation, fat-loss signaling. Human data limited.',
    beginnerProtocol:
      'Research protocols: 50–150 mg PO daily.',
    cycleTemplate: {
      duration_weeks: 12,
      phase_notes: 'Oral, daily, cycled for metabolic resets.',
      schedule: '100 mg PO once daily, 12 weeks, then 4-week break.',
    },
    timing: 'Morning with food.',
    coAdministration: [],
    stackConflicts: [],
  },

  motsc: {
    benefits:
      'Mitochondrial-derived peptide (12S rRNA encoded). Research on metabolic regulation, exercise capacity, insulin sensitivity, mitochondrial biogenesis.',
    beginnerProtocol:
      'Research protocols: 5–10 mg SubQ weekly.',
    cycleTemplate: {
      duration_weeks: 12,
      phase_notes: 'Weekly dosing; cycled 12 weeks on, 4 weeks off.',
      schedule: '10 mg SubQ weekly (pre-workout or morning) for 12 weeks.',
    },
    timing: 'Morning or pre-workout; empty stomach preferred.',
    coAdministration: [
      { peptide_id: 'ss31', note: 'Dual mitochondrial-support approach.' },
    ],
    stackConflicts: [],
  },
};
