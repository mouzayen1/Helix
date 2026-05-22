import type { PeptideExtrasMap } from './types';

export const COGNITIVE_EXTRAS: PeptideExtrasMap = {
  selank: {
    benefits:
      'Anxiolytic heptapeptide (Russian clinical use). Studied for anxiety-reduction, anti-stress, potential attention benefits; modulates GABA and BDNF pathways.',
    beginnerProtocol:
      'Russian clinical protocols: 75 mcg per nostril, 2–3 times daily (intranasal).',
    cycleTemplate: {
      duration_weeks: 2,
      phase_notes: 'Short intranasal courses (10–14 days) with breaks between.',
      schedule: '150 mcg intranasal (75 mcg per nostril) 2–3× daily for 10–14 days.',
    },
    timing: 'Morning + mid-day + optional evening. Avoid within 1 hour of sleep.',
    coAdministration: [],
    stackConflicts: [],
    sideEffects: [
      'Mild nasal irritation or post-nasal drip',
      'Transient drowsiness or sedation in some users',
      'Headache reported anecdotally',
      'Long-term safety outside of Russian clinical literature is limited',
    ],
    contraindications: [
      'Pregnancy and breastfeeding',
      'Active depression on medication (limited interaction data)',
    ],
    overview: {
      whatItDoes:
        'Selank is a synthetic peptide based on tuftsin, a small immune-modulating compound your body produces naturally. Russian researchers developed it in the 1990s primarily as an anti-anxiety compound — it produces a calming effect without the sedation, dependency, or cognitive blunting of benzodiazepines. It also appears to support memory and immune function. Most clinical research has been done in Russia and Eastern Europe; Western data is more limited but growing. Typically used intranasally for fast onset.',
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Stable up to 2 years frozen.',
        afterMixing: 'Refrigerate. Use within 30 days.',
        handling:
          'Intranasal preparations: refrigerate after opening, use within 30 days. Keep the nozzle clean. Keep away from light.',
      },
    },
  },

  semax: {
    benefits:
      'Nootropic heptapeptide (ACTH(4-10) analog). Research on BDNF upregulation, cognitive enhancement, neuroprotection after ischemic events; Russian clinical use.',
    beginnerProtocol:
      'Russian clinical protocols: 250–500 mcg intranasal 2–3× daily.',
    cycleTemplate: {
      duration_weeks: 2,
      phase_notes: 'Short cycles (10–14 days) with breaks.',
      schedule: '250 mcg intranasal 2× daily (AM + early afternoon) for 10–14 days.',
    },
    timing: 'Morning and early afternoon. Avoid evening dosing (can impair sleep).',
    coAdministration: [],
    stackConflicts: [],
    sideEffects: [
      'Insomnia or sleep disruption with late dosing',
      'Nasal irritation; rhinitis with frequent intranasal use',
      'Transient over-stimulation, headache, irritability',
      'Long-term safety outside of Russian clinical literature is limited',
    ],
    contraindications: [
      'Pregnancy and breastfeeding',
      'Anxiety / agitation disorders (stimulation can worsen)',
    ],
    overview: {
      whatItDoes:
        "Semax is the cognitive cousin of Selank — a synthetic peptide based on a fragment of ACTH (a pituitary hormone), modified to remove the hormone-stimulating effects while keeping the brain-protective ones. Russian researchers developed it primarily for stroke recovery, where it has clinical evidence for improving outcomes. Outside of stroke contexts, it's used as a focus and cognitive-performance peptide — users report improved concentration, mental energy, and motivation. Like Selank, most research is Eastern European.",
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Stable up to 2 years frozen.',
        afterMixing: 'Refrigerate. Use within 30 days.',
        handling:
          'Intranasal preparations: refrigerate after opening, use within 30 days. Keep away from light.',
      },
    },
  },

  cerebro: {
    benefits:
      'Porcine-derived brain peptide mixture. Clinical use in stroke rehabilitation, Alzheimer disease, traumatic brain injury research.',
    beginnerProtocol:
      'Clinical IM/IV protocols: 5–30 mL daily over 10–20 day courses, depending on indication.',
    cycleTemplate: {
      duration_weeks: 3,
      phase_notes: 'Short clinical courses; repeated 2–4× per year in some protocols.',
      schedule: '10 mL IM daily for 20 days, repeat 2–4× per year.',
    },
    timing: 'Morning is typical in clinical protocols.',
    coAdministration: [],
    stackConflicts: [],
    sideEffects: [
      'Injection-site pain (IM)',
      'Sweating, dizziness, nausea reported in clinical use',
      'Hypersensitivity reactions including rash',
      'Hot flashes / vasomotor symptoms',
    ],
    contraindications: [
      'Severe renal impairment',
      'Status epilepticus',
      'Hypersensitivity to porcine-derived products',
      'Pregnancy and breastfeeding',
    ],
    overview: {
      whatItDoes:
        "Cerebrolysin isn't a single peptide — it's a mixture of small peptides and amino acids derived from pig brain tissue. It mimics the activity of natural neurotrophic factors (proteins that keep neurons healthy), which is why it's used clinically in many countries (though not the US) for stroke recovery, traumatic brain injury, and dementia. Strong clinical data supports its use for acute stroke and TBI; long-term cognitive enhancement use has weaker evidence. Typically given as a series of injections in pulses (e.g., 5–10 days on, then weeks off) rather than continuous daily use.",
      storage: {
        beforeMixing:
          'Cerebrolysin typically comes pre-formulated as a sterile solution in ampoules — no reconstitution needed. Refrigerate at 36–46°F (2–8°C). Some manufacturers allow short-term room temperature storage.',
        afterMixing:
          'Use ampoules immediately after opening; do not save partial ampoules.',
        handling: 'Keep away from light.',
      },
    },
  },

  dihexa: {
    benefits:
      'Angiotensin IV analog, oral-active. Preclinical research on hepatocyte growth factor pathway, dendritic spine density, cognition.',
    beginnerProtocol:
      'No human data. Preclinical rodent studies used microgram/kg oral dosing.',
    cycleTemplate: {
      duration_weeks: 4,
      phase_notes: 'Limited human data — research-only context.',
      schedule: 'No standardized human protocol.',
    },
    timing: 'No established timing.',
    coAdministration: [],
    stackConflicts: [],
    sideEffects: [
      'No human safety data — this is research-only',
      'Pre-clinical reports indicate it crosses the BBB; off-target effects in humans unknown',
    ],
    contraindications: [
      'No human use data — research context only',
      'Pregnancy and breastfeeding',
    ],
    overview: {
      whatItDoes:
        'Dihexa is a synthetic compound (technically not a peptide despite often being grouped with them) developed at Washington State University, designed to mimic the brain-supporting effects of angiotensin IV. In animal studies, it\'s been described as roughly seven orders of magnitude more potent than BDNF (a well-known brain growth factor) for promoting new connections between neurons. Researchers explore it for cognitive enhancement, recovery from TBI, and neurodegenerative conditions. All evidence is preclinical — no human clinical trials have been published. Available as oral or topical preparations.',
      storage: {
        beforeMixing:
          'Most often supplied as oral or topical solutions — store at room temperature, away from light and humidity.',
        afterMixing:
          'If supplied as injectable powder: refrigerate at 36–46°F (2–8°C). After mixing, refrigerate and use within 30 days.',
      },
    },
  },
};
