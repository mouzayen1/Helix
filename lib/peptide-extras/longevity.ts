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
    sideEffects: [
      'Injection-site reactions',
      'Vivid dreams or shifted sleep architecture',
      'Mild headache or fatigue early in a course',
      'Long-term human safety data outside Russian clinical literature is limited',
    ],
    contraindications: [
      'Pregnancy and breastfeeding',
      'Active malignancy (telomerase modulation theoretical concern)',
    ],
    overview: {
      whatItDoes:
        'Epitalon is a four-amino-acid peptide developed by Russian researcher Vladimir Khavinson, designed to mimic a natural compound called epithalamin found in the pineal gland. Its primary research interest is telomerase activation — telomeres are the protective caps on your chromosomes that shorten with age, and Epitalon has shown ability to lengthen them in laboratory studies. Russian clinical studies in elderly populations report improvements in sleep, melatonin rhythm, and possibly lifespan. Western research is much more limited. Typically used in short pulsed protocols (10–20 days, once or twice per year) rather than continuous daily use.',
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Stable up to 2 years frozen.',
        afterMixing: 'Refrigerate. Use within 30 days.',
        handling: 'Keep away from light. Swirl gently to dissolve.',
      },
    },
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
    sideEffects: [
      'Injection-site reactions (most common trial finding)',
      'Headache and dizziness',
      'GI upset (nausea, diarrhea) at higher doses',
      'Long-term safety in non-trial populations is not characterized',
    ],
    contraindications: [
      'Pregnancy and breastfeeding',
      'Severe renal impairment (clearance not fully studied)',
    ],
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
    sideEffects: [
      'Flushing, warmth, chest pressure during injection (rate-dependent)',
      'Nausea or queasiness during fast pushes',
      'Headache, fatigue, mild dizziness',
      'Injection-site bruising or soreness',
      'Theoretical concern: NAD+ may fuel proliferation in active cancer',
    ],
    contraindications: [
      'Active malignancy',
      'Pregnancy and breastfeeding',
      'Severe cardiovascular disease (the flushing reaction can be intense)',
    ],
    overview: {
      whatItDoes:
        "NAD+ isn't a peptide — it's a coenzyme your cells use for energy production and DNA repair. Levels naturally drop with age (estimates put 60-year-olds at half the levels of 20-year-olds), and many longevity researchers consider this drop central to many aspects of aging. NAD+ injections aim to restore those levels directly, with reports of improved energy, cognition, and metabolic function. Strong preclinical data; emerging human clinical research. Note that injections are uncomfortable for many people — slow infusion is often preferred.",
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). NAD+ is more sensitive to heat and light than most peptides.',
        afterMixing:
          'Refrigerate. Use within 14 days — NAD+ degrades faster post-reconstitution than most peptides.',
        handling:
          'Keep away from light. The solution should be clear and slightly yellow — discard if the color deepens significantly.',
      },
    },
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
    sideEffects: [
      'No human safety data — pre-clinical context only',
      'Senolytic mechanism could theoretically affect non-target tissues',
    ],
    contraindications: [
      'No human use protocol — research context only',
      'Pregnancy and breastfeeding',
      'Active malignancy without oncologist oversight',
    ],
    overview: {
      whatItDoes:
        'FOXO4-DRI is an experimental "senolytic" peptide — designed to selectively kill senescent cells. Senescent cells are old cells that have stopped dividing but refuse to die; they accumulate with age and produce inflammatory signals that contribute to many age-related conditions. FOXO4-DRI selectively triggers the death of these "zombie" cells while sparing healthy ones, at least in laboratory and animal studies. Most research is preclinical; human data is essentially nonexistent. Considered one of the most exciting longevity research compounds, but also one with the least real-world safety data.',
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Stable up to 2 years frozen.',
        afterMixing: 'Refrigerate. Use within 30 days.',
        handling: 'Keep away from light. Swirl gently to dissolve.',
      },
    },
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
    sideEffects: [
      'Limited human safety data',
      'Injection-site reactions plausible',
    ],
    contraindications: [
      'No human use protocol — research context only',
      'Pregnancy and breastfeeding',
    ],
    overview: {
      whatItDoes:
        'Humanin is a small peptide encoded by your mitochondrial DNA — like MOTS-c, it\'s part of a small family of "mitochondrial peptides" that researchers think coordinate energy metabolism and stress response across cells. Humanin has shown protective effects against neurodegenerative diseases, metabolic dysfunction, and various forms of cellular stress in animal studies. Some longevity researchers describe it as a "longevity gene" peptide. Most evidence is preclinical; human data is very limited.',
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Stable up to 2 years frozen.',
        afterMixing: 'Refrigerate. Use within 30 days.',
        handling: 'Keep away from light. Swirl gently to dissolve.',
      },
    },
  },
};
