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
  },

  igflr3: {
    benefits:
      'Long-R3 IGF-1. Research on muscle protein synthesis, satellite-cell proliferation, anabolic signaling. Long half-life (~20–30 h) vs native IGF-1.',
    beginnerProtocol:
      'Research protocols: 20–50 mcg SubQ daily.',
    cycleTemplate: {
      duration_weeks: 4,
      phase_notes: 'Short cycles (4 weeks on / 4 off) to avoid receptor downregulation.',
      schedule: '40 mcg SubQ daily, post-workout on training days, for 4 weeks.',
    },
    timing: 'Post-workout (within 30 min) on training days.',
    coAdministration: [],
    stackConflicts: [
      { peptide_id: 'igfdes', reason: 'Both IGF-1 analogs — redundant receptor activation.' },
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
  },
};
