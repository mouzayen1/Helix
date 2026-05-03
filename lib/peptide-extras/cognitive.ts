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
  },
};
