import type { PeptideExtrasMap } from './types';

export const LONGEVITY_EXTRAS: PeptideExtrasMap = {
  epi: {
    benefits:
      "Khavinson's pineal tetrapeptide (Ala-Glu-Asp-Gly). Russian research on telomerase activation, sleep-wake regulation, melatonin production; elderly-population clinical studies.",
    beginnerProtocol:
      'Russian clinical protocols: 5–10 mg SubQ daily for 10–20 days, repeated 2×/year.',
    cycleTemplate: {
      duration_weeks: 3,
      phase_notes: 'Short courses (10–20 days), typically repeated every 4–6 months.',
      schedule: '10 mg SubQ daily × 10 days, then 6-month break.',
    },
    timing: 'Evening dosing is traditional (aligns with pineal / melatonin rhythm).',
    coAdministration: [],
    stackConflicts: [],
  },

  ss31: {
    benefits:
      'Mitochondria-targeted tetrapeptide (Elamipretide). Selectively binds cardiolipin in inner mitochondrial membrane; clinical trials in primary mitochondrial myopathy, age-related macular degeneration, heart failure.',
    beginnerProtocol:
      'Clinical trial range: 5–40 mg SubQ daily.',
    cycleTemplate: {
      duration_weeks: 12,
      phase_notes: 'Long trials (up to 48 weeks reported).',
      schedule: '10 mg SubQ daily for 12 weeks, reassess.',
    },
    timing: 'Morning; consistent time each day.',
    coAdministration: [
      { peptide_id: 'motsc', note: 'Complementary mitochondrial-support rationale.' },
    ],
    stackConflicts: [],
  },

  nad: {
    benefits:
      'Injectable NAD+. Research on mitochondrial function, NAD+/sirtuin pathway, energy metabolism. Subjective benefits reported for fatigue and cognitive clarity.',
    beginnerProtocol:
      'Research protocols: 100–300 mg SubQ or IM, 1–5× weekly; IV infusions up to 500–1000 mg.',
    cycleTemplate: {
      duration_weeks: 4,
      phase_notes: 'Short loading cycles (2–4 weeks) with maintenance.',
      schedule: '250 mg SubQ daily × 5, then 2–3× weekly maintenance for 4 weeks.',
    },
    timing: 'Morning. Injections can cause transient flushing and nausea — dose slowly.',
    coAdministration: [],
    stackConflicts: [],
  },

  foxo: {
    benefits:
      'Senolytic peptide (FOXO4-p53 interaction disruptor). Preclinical research on selective elimination of senescent cells in aged mice.',
    beginnerProtocol:
      'No standardized human dose. Preclinical murine studies used 5 mg/kg IP every 3 days.',
    cycleTemplate: {
      duration_weeks: 2,
      phase_notes: 'No human data; research-only context.',
      schedule: 'Not defined for human use.',
    },
    timing: 'No established timing.',
    coAdministration: [],
    stackConflicts: [],
  },

  humanin: {
    benefits:
      'Mitochondrial-derived cytoprotective peptide. Research on neuroprotection (Alzheimer models), cardioprotection, metabolic regulation.',
    beginnerProtocol:
      'No standardized human dose. Limited clinical data.',
    cycleTemplate: {
      duration_weeks: 4,
      phase_notes: 'Research-only context.',
      schedule: 'Not defined for human use.',
    },
    timing: 'No established timing.',
    coAdministration: [],
    stackConflicts: [],
  },
};
