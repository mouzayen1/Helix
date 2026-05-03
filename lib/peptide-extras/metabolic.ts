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
    sideEffects: [
      'Nausea, vomiting, diarrhea, constipation (most common; usually worst right after dose increases)',
      'Reduced appetite to the point of skipping meals',
      'Heartburn / reflux on higher doses',
      'Fatigue and headache during titration',
      'Pancreatitis (rare but a known class risk)',
      'Gallbladder disease, including cholelithiasis',
    ],
    contraindications: [
      'Personal or family history of medullary thyroid carcinoma',
      'Multiple Endocrine Neoplasia syndrome type 2 (MEN2)',
      'Active or prior pancreatitis',
      'Pregnancy (label: stop ≥2 months before planned conception)',
    ],
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
    sideEffects: [
      'Nausea, vomiting, diarrhea, constipation — same GI cluster as semaglutide',
      'Decreased appetite; risk of inadequate intake',
      'Injection-site reactions',
      'Pancreatitis (class risk)',
      'Gallbladder disease',
      'Hypoglycemia when used with insulin or sulfonylureas',
    ],
    contraindications: [
      'Personal or family history of medullary thyroid carcinoma',
      'MEN2 syndrome',
      'Active or prior pancreatitis',
      'Pregnancy',
    ],
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
    sideEffects: [
      'Strong GI cluster: nausea, vomiting, diarrhea',
      'Mild heart-rate elevation reported in trials',
      'Decreased appetite; risk of inadequate intake',
      'Injection-site reactions',
      'Investigational — long-term safety profile still being characterized',
    ],
    contraindications: [
      'Personal or family history of medullary thyroid carcinoma',
      'MEN2 syndrome',
      'Active or prior pancreatitis',
      'Pregnancy',
    ],
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
    sideEffects: [
      'Nausea, vomiting, diarrhea, constipation — daily GI burden often higher than once-weekly GLP-1s',
      'Injection-site reactions',
      'Hypoglycemia when paired with insulin or sulfonylureas',
      'Pancreatitis (class risk)',
      'Gallbladder disease',
    ],
    contraindications: [
      'Personal or family history of medullary thyroid carcinoma',
      'MEN2 syndrome',
      'Active or prior pancreatitis',
      'Pregnancy',
    ],
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
    sideEffects: [
      'Nausea (less than GLP-1 alone in trials but still common)',
      'Decreased appetite; rapid satiety',
      'Injection-site reactions',
      'Investigational — long-term safety profile still being established',
    ],
    contraindications: [
      'Pregnancy',
      'Active pancreatitis',
    ],
  },

  aod: {
    benefits:
      'hGH 176-191 fragment. Marketed for lipolytic / fat-loss effects. Human clinical trials have been mixed and the strongest claims (fat-only loss without GH effects) are not well supported.',
    beginnerProtocol:
      'Research protocols: 250–500 mcg SubQ daily, morning, empty stomach. 5-on/2-off schedule is common for longer cycles to preserve response.',
    cycleTemplate: {
      duration_weeks: 12,
      phase_notes: 'Cycled 8–12 weeks on, 4 weeks off. 5-on/2-off pattern common in research contexts.',
      schedule: '300 mcg SubQ morning, 5 days on / 2 off, for 12 weeks.',
      phases: [
        { name: 'Active (5-on / 2-off)', weeks: 12, dose_modifier: '300 mcg SubQ morning, 5 days on + 2 days off' },
      ],
    },
    timing: 'Morning, empty stomach, 20–30 minutes before breakfast or pre-cardio.',
    coAdministration: [],
    stackConflicts: [],
    commonMistakes: [
      'Eating within 30 min of a dose — the pre-feed fasted window is part of the research protocol.',
    ],
    proTips: [
      'Pair with fasted morning cardio if following published fat-loss research protocols.',
    ],
    sideEffects: [
      'Generally well-tolerated in trials; injection-site reactions most common',
      'Mild headache or fatigue reported anecdotally',
      'Effect size in human trials has been modest — disappointment is the most common "side effect"',
    ],
    contraindications: [
      'Pregnancy and breastfeeding',
    ],
  },

  tesofensine: {
    benefits:
      'Oral triple monoamine-reuptake inhibitor (NE, DA, 5-HT). Phase-2/3 trials (TIPO-1, TIPO-4) reported significant weight loss and appetite reduction. Also investigated for Parkinson-related fatigue.',
    beginnerProtocol:
      'Clinical trial range: 0.25–1.0 mg PO daily. Research dose-ranging: start at 500 mcg (0.5 mg) daily; some protocols used 250 mcg to assess tolerance. Cycles typically 8–24 weeks.',
    cycleTemplate: {
      duration_weeks: 12,
      phase_notes: 'Long oral cycles (8–24 weeks) in trials. Monitor blood pressure; monoamine effects can elevate BP.',
      schedule: '500 mcg PO once daily, morning, for 12 weeks; titrate per tolerance.',
    },
    timing: 'Morning with water. Evening dosing can disrupt sleep due to monoamine stimulation.',
    coAdministration: [],
    stackConflicts: [
      { peptide_id: 'sema', reason: 'Unknown-risk combination; both act on appetite pathways. Research lacks head-to-head data.' },
      { peptide_id: 'tirz', reason: 'Same rationale as semaglutide.' },
      { peptide_id: 'reta', reason: 'Same rationale as semaglutide.' },
    ],
    commonMistakes: [
      'Evening dosing — causes insomnia in a meaningful fraction of users due to dopamine/norepinephrine stimulation.',
      'Ignoring blood-pressure monitoring — trial safety data required periodic checks.',
    ],
    proTips: [
      'Starting at 250 mcg for the first week to assess tolerance before moving to 500 mcg is a common research approach.',
    ],
    sideEffects: [
      'Insomnia, especially with evening dosing',
      'Elevated blood pressure and heart rate',
      'Dry mouth, headache',
      'Mood changes / agitation in a subset of users',
      'Constipation',
    ],
    contraindications: [
      'Cardiovascular disease, uncontrolled hypertension, or arrhythmia',
      'MAOI use within 14 days',
      'Pregnancy and breastfeeding',
      'Anxiety disorders or psychiatric history (monoamine stimulation can worsen)',
    ],
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
    sideEffects: [
      'Limited human safety data — most reports come from rodent studies',
      'Mild GI upset reported anecdotally',
      'Long-term effects of NNMT inhibition in humans not yet characterized',
    ],
    contraindications: [
      'Pregnancy and breastfeeding',
    ],
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
    sideEffects: [
      'Injection-site reactions',
      'Mild fatigue or headache early in a course',
      'Long-term human safety data is limited',
    ],
    contraindications: [
      'Pregnancy and breastfeeding',
    ],
  },
};
