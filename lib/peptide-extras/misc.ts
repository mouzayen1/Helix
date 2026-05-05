import type { PeptideExtrasMap } from './types';

// Sexual health, hormonal, neuropeptide, sleep, anabolic — combined for compactness.

export const MISC_EXTRAS: PeptideExtrasMap = {
  pt141: {
    benefits:
      'Melanocortin agonist (Vyleesi®). FDA-approved for hypoactive sexual desire disorder in premenopausal women. Central-mechanism libido enhancer.',
    beginnerProtocol:
      'Label: 1.75 mg SubQ as needed, ≥45 min before anticipated sexual activity. Max 1 dose per 24h, no more than 8 doses/month.',
    cycleTemplate: {
      duration_weeks: 0,
      phase_notes: 'As-needed dosing — not a continuous cycle.',
      schedule: '1.75 mg SubQ 45–60 min before sexual activity, max 8×/month.',
    },
    timing: '45–60 min before anticipated activity. Can cause transient nausea, flushing, BP rise.',
    coAdministration: [],
    stackConflicts: [
      { peptide_id: 'mt2', reason: 'Both melanocortin agonists — compounding cardiovascular and nausea effects.' },
    ],
    sideEffects: [
      'Nausea (most common label finding; ~40% of trial users)',
      'Flushing, headache, transient blood-pressure rise',
      'Injection-site reactions',
      'Focal hyperpigmentation, including darkening of moles or gums',
      'Vomiting at higher doses',
    ],
    contraindications: [
      'Uncontrolled hypertension or cardiovascular disease',
      'Pregnancy and breastfeeding',
      'Known hypersensitivity to bremelanotide',
    ],
  },

  mt2: {
    benefits:
      'Non-selective melanocortin agonist. Research on skin pigmentation (tanning), libido. Not FDA-approved. Notable side effects: nausea, hypertension, melanocytic nevi darkening.',
    beginnerProtocol:
      'Research protocols: start 250 mcg SubQ, titrate by 250 mcg every 2–3 days to 1 mg max, based on tolerance and desired pigment response.',
    cycleTemplate: {
      duration_weeks: 4,
      phase_notes: 'Loading phase (daily) to achieve response, then 1–2× weekly maintenance.',
      schedule: 'Loading: 500 mcg SubQ daily until desired effect (~2–4 weeks). Maintenance: 500 mcg 1–2× weekly.',
    },
    timing: 'Evening — sleep through nausea side effect.',
    coAdministration: [],
    stackConflicts: [
      { peptide_id: 'pt141', reason: 'Both melanocortin agonists — overstimulation risk.' },
      { peptide_id: 'sema', reason: 'Additive nausea risk.' },
      { peptide_id: 'tirz', reason: 'Additive nausea risk.' },
    ],
    sideEffects: [
      'Strong nausea (often dose-limiting)',
      'Flushing, hypertension, increased heart rate',
      'Darkening of existing moles and new nevus formation — dermatologic monitoring is research convention',
      'Spontaneous erections in males; libido increase',
      'Loss of appetite',
      'Long-term carcinogenic risk of unregulated melanocortin stimulation is unknown',
    ],
    contraindications: [
      'Personal or family history of melanoma',
      'Many atypical or large nevi',
      'Uncontrolled hypertension or cardiovascular disease',
      'Pregnancy and breastfeeding',
    ],
  },

  kiss10: {
    benefits:
      'GnRH-stimulating decapeptide. Research on HPG-axis activation, LH/FSH pulse restoration, reproductive endocrinology, hypothalamic amenorrhea.',
    beginnerProtocol:
      'Research protocols: 10 mcg/kg SubQ or IV; pulse-dosing every 90 min in fertility research.',
    cycleTemplate: {
      duration_weeks: 2,
      phase_notes: 'Research-context only; pulsed dosing in fertility protocols.',
      schedule: 'Per-kg dosing; not standardized for non-clinical use.',
    },
    timing: 'Pulsatile dosing mimicking natural GnRH rhythm.',
    coAdministration: [],
    stackConflicts: [],
    sideEffects: [
      'Headache, nausea reported in fertility trials',
      'Injection-site reactions',
      'Reproductive-axis stimulation can be undesirable in non-fertility contexts',
    ],
    contraindications: [
      'Hormone-sensitive cancers',
      'Pregnancy (unless under specific fertility protocol)',
      'No standardized non-clinical protocol',
    ],
  },

  oxy: {
    benefits:
      'Social-bonding nonapeptide hormone. Research on pair-bonding, anxiety, trust, autism-spectrum social functioning.',
    beginnerProtocol:
      'Research protocols: 20–40 IU intranasal per administration; single- or repeat-dose paradigms.',
    cycleTemplate: {
      duration_weeks: 4,
      phase_notes: 'Research-context only.',
      schedule: '24 IU intranasal as needed or daily, per study protocol.',
    },
    timing: '30–60 min before social/therapeutic context.',
    coAdministration: [],
    stackConflicts: [],
    sideEffects: [
      'Nasal irritation or runny nose with intranasal use',
      'Headache, nausea reported in trials',
      'Paradoxical effects on social anxiety in some users (anxiety can increase rather than decrease)',
      'Long-term safety with chronic use is not well characterized',
    ],
    contraindications: [
      'Pregnancy (uterine-stimulating mechanism)',
      'Breastfeeding (oxytocin readily transfers)',
      'Active psychiatric crisis without clinical supervision',
    ],
  },

  dsip: {
    benefits:
      'Delta Sleep-Inducing Peptide. Research on slow-wave sleep modulation, stress response, withdrawal-state regulation.',
    beginnerProtocol:
      'Research protocols: 100–750 mcg SubQ or IV pre-bed.',
    cycleTemplate: {
      duration_weeks: 4,
      phase_notes: 'Short cycles (2–4 weeks) with breaks.',
      schedule: '200–500 mcg SubQ pre-bed, 5 nights per week, for 4 weeks.',
    },
    timing: '30–60 min before intended sleep.',
    coAdministration: [],
    stackConflicts: [],
    sideEffects: [
      'Mild morning grogginess',
      'Vivid dreams',
      'Injection-site reactions',
      'Limited human safety data; effect sizes are inconsistent across studies',
    ],
    contraindications: [
      'Pregnancy and breastfeeding',
      'Severe untreated sleep-disordered breathing (any sedating peptide warrants caution)',
    ],
  },

  igflr3: {
    benefits:
      'Long-R3 IGF-1. Research on muscle protein synthesis, satellite-cell proliferation, anabolic signaling. Long half-life (~20–30 h) vs native IGF-1.',
    beginnerProtocol:
      'Research protocols: 20–50 mcg SubQ daily. CRITICAL: reconstitute with 0.6% acetic acid (NOT BAC water) — IGF-1 LR3 is unstable in bacteriostatic water and degrades rapidly. Once reconstituted, refrigerate and use within 24 hours.',
    cycleTemplate: {
      duration_weeks: 4,
      phase_notes: 'Short cycles (4 weeks on / 4 off) to avoid receptor downregulation. Reconstitute fresh and use within 24 h.',
      schedule: '40 mcg SubQ daily, post-workout on training days, for 4 weeks. Fresh reconstitution every 24h.',
    },
    timing: 'Post-workout (within 30 min) on training days.',
    coAdministration: [],
    stackConflicts: [
      { peptide_id: 'igfdes', reason: 'Both IGF-1 analogs — redundant receptor activation.' },
    ],
    commonMistakes: [
      'Reconstituting with bacteriostatic water — IGF-1 LR3 degrades in BAC water. Use 0.6% acetic acid only.',
      'Storing reconstituted solution longer than 24 hours — activity drops significantly after that window.',
      'Using a previously-made vial from another peptide as a reference for diluent — IGF-1 LR3 is uniquely unstable.',
    ],
    proTips: [
      '0.6% acetic acid specifically is the research diluent for IGF-1 — vinegar or other diluents will not stabilize it.',
      'Plan the 4-week cycle in advance and only reconstitute what will be used within 24 h.',
      'Refrigerate between doses; do not freeze.',
    ],
    sideEffects: [
      'Hypoglycemia, especially when taken pre-meal — can be severe',
      'Injection-site swelling, redness, lipohypertrophy at chronic sites',
      'Acromegalic-style soft-tissue changes with long-term high-dose use',
      'Joint pain, headache, fatigue',
      'Theoretical concern: IGF-1 elevation may promote pre-existing malignancy',
    ],
    contraindications: [
      'Active malignancy or strong family history of hormone-sensitive cancers',
      'Hypoglycemia-prone individuals',
      'Pregnancy and breastfeeding',
      'Diabetic retinopathy (IGF-1 can worsen proliferative retinopathy)',
    ],
  },

  igfdes: {
    benefits:
      'Des(1-3) IGF-1. Truncated analog with higher local activity and reduced IGFBP binding. Site-specific hypertrophy research.',
    beginnerProtocol:
      'Research protocols: 50–100 mcg per target muscle, post-workout.',
    cycleTemplate: {
      duration_weeks: 4,
      phase_notes: 'Site-specific post-workout administration, short cycles.',
      schedule: '50–100 mcg SubQ localized to trained muscle, post-workout, for 4 weeks.',
    },
    timing: 'Immediately post-workout.',
    coAdministration: [],
    stackConflicts: [
      { peptide_id: 'igflr3', reason: 'Both IGF-1 analogs — redundant.' },
    ],
    sideEffects: [
      'Hypoglycemia post-dose',
      'Injection-site swelling and lipohypertrophy at repeated sites',
      'Local soft-tissue overgrowth with chronic site-specific use',
      'Joint pain at higher doses',
    ],
    contraindications: [
      'Active malignancy',
      'Hypoglycemia-prone individuals',
      'Pregnancy and breastfeeding',
    ],
  },

  pegmgf: {
    benefits:
      'Pegylated Mechano Growth Factor — splice variant of IGF-1 released by damaged muscle. Research on satellite-cell activation and repair after mechanical stress.',
    beginnerProtocol:
      'Research protocols: 100–400 mcg SubQ, 2–3× per week.',
    cycleTemplate: {
      duration_weeks: 4,
      phase_notes: 'Short cycles; post-workout administration on training days.',
      schedule: '200–400 mcg SubQ post-workout on training days, for 4 weeks.',
    },
    timing: 'Post-workout (within 60 min) on training days.',
    coAdministration: [],
    stackConflicts: [],
    sideEffects: [
      'Injection-site reactions',
      'Mild fatigue or post-injection lethargy',
      'Limited long-term human safety data',
    ],
    contraindications: [
      'Active malignancy',
      'Pregnancy and breastfeeding',
    ],
  },
};
