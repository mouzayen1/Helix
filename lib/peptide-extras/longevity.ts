import type { PeptideExtrasMap } from './types';

export const LONGEVITY_EXTRAS: PeptideExtrasMap = {
  epi: {
    benefits:
      "Khavinson's pineal tetrapeptide (Ala-Glu-Asp-Gly). Russian research on telomerase activation, sleep-wake regulation, melatonin production; elderly-population clinical studies.",
    beginnerProtocol:
      "Conservative start: 5 mg SubQ daily × 10 days. Khavinson's published range is 5–10 mg daily × 10–20 days, repeated 2×/year. 5 mg is the safer starting point for first-time users.",
    cycleTemplate: {
      duration_weeks: 3,
      phase_notes: 'Short courses (10–20 days), typically repeated every 4–6 months. Starting at 5 mg and titrating up after a full course is a reasonable conservative approach.',
      schedule: '5 mg SubQ daily × 10 days for first course; subsequent courses can use 10 mg daily × 10–20 days. 4–6 month break between courses.',
    },
    timing: 'Evening dosing is traditional (aligns with pineal / melatonin rhythm).',
    coAdministration: [],
    stackConflicts: [],
    commonMistakes: [
      'Running continuously beyond 20 days per course — published protocols explicitly cycle.',
      'Starting at the high end (10 mg) without a tolerance course.',
    ],
    proTips: [
      'Evening injection 30–60 min before bed aligns the dosing window with the natural pineal rhythm the peptide is meant to modulate.',
    ],
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
      'Conservative research-context dose: 100 mg SubQ 2–3× weekly (Mon / Wed / Fri). Clinic protocols occasionally go higher (up to 250 mg daily for short loading) but most longevity research clusters at 100 mg 2–3× weekly.',
    cycleTemplate: {
      duration_weeks: 4,
      phase_notes: 'Short loading possible (2 weeks daily), then 2–3× weekly maintenance. Injection rate matters more than total dose — push slowly over 60+ seconds to minimize flushing.',
      schedule: '100 mg SubQ 2–3× weekly for 4 weeks. Optional loading: 100 mg daily × 7 days then step down.',
      phases: [
        { name: 'Optional loading', weeks: 1, dose_modifier: '100 mg SubQ daily × 7 days' },
        { name: 'Maintenance', weeks: 3, dose_modifier: '100 mg SubQ 2–3× weekly (Mon / Wed / Fri)' },
      ],
    },
    timing: 'Morning. Injections cause flushing, nausea, and chest warmth — these scale with injection RATE, not total dose. Push slowly over 60+ seconds.',
    coAdministration: [],
    stackConflicts: [],
    commonMistakes: [
      'Fast injection — the flushing / nausea people complain about is almost always a speed issue, not a dose issue.',
      'Starting at 250+ mg/day without tolerance — lower-and-slower gives the same sirtuin pathway engagement with fewer side effects.',
    ],
    proTips: [
      'If flushing is intense, halve the injection rate and break the dose into 2 pushes, 30–60 seconds apart.',
    ],
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
