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
    overview: {
      whatItDoes:
        'PT-141 is a synthetic peptide that activates melanocortin receptors in the brain — specifically the ones involved in sexual arousal pathways. Unlike Viagra and similar drugs, which work on blood flow, PT-141 works on the central nervous system signal for arousal itself. FDA-approved for low sexual desire in premenopausal women under the brand Vyleesi. Used off-label by both men and women for arousal and erectile concerns, especially when blood-flow drugs haven\'t worked. Effects typically begin 2–6 hours after injection and can last several hours.',
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Stable up to 2 years frozen.',
        afterMixing: 'Refrigerate. Use within 30 days.',
        handling: 'Keep away from light. Swirl gently to dissolve.',
      },
    },
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
    overview: {
      whatItDoes:
        'Melanotan II is a synthetic peptide that activates the same melanocortin receptors as PT-141, but with broader activity — it triggers melanin production in skin (the actual "tanning" effect, independent of UV exposure), affects sexual arousal, and can suppress appetite. Originally researched as a sunless tanning aid; has become popular for cosmetic skin darkening and as a "tan accelerator." Not FDA-approved for any use. The combination of pigment-changing effects with the same nausea and cardiovascular profile as PT-141 makes the side-effect profile heavier than most peptides.',
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Stable up to 2 years frozen.',
        afterMixing: 'Refrigerate. Use within 30 days.',
        handling: 'Keep away from light. Swirl gently to dissolve.',
      },
    },
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
    overview: {
      whatItDoes:
        'Kisspeptin-10 is the active fragment of kisspeptin, a natural peptide your hypothalamus produces to control reproductive hormone signaling. It triggers your body to release LH and FSH, which then stimulate your gonads to produce testosterone (males) or estrogen and follicle development (females). Researchers explore it for restoring hormonal function — particularly in cases where the natural signal has been suppressed (e.g., after long-term hormonal therapy, or in certain reproductive disorders). Increasingly studied clinically; less speculative than many peptides on this list. Has been used in human reproductive medicine research.',
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Stable up to 2 years frozen.',
        afterMixing: 'Refrigerate. Use within 30 days.',
        handling: 'Keep away from light. Swirl gently to dissolve.',
      },
    },
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
    overview: {
      whatItDoes:
        'Oxytocin is a natural hormone your hypothalamus produces, often called "the bonding hormone" because of its role in childbirth, breastfeeding, and social attachment. Synthetic oxytocin is FDA-approved for inducing labor and controlling postpartum bleeding (under the brand Pitocin). Outside those clinical uses, researchers and users explore it for social anxiety, bonding, autism-spectrum support, and as an aid for couples therapy contexts. Effects on mood and social behavior are subtle and variable — not everyone responds the same way, and high-quality human research outside of childbirth applications is limited. Most often used as a nasal spray for the cognitive/social applications.',
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Stable up to 2 years frozen.',
        afterMixing: 'Refrigerate. Use within 30 days.',
        handling:
          'Nasal spray preparations: refrigerate after opening, use within 30 days. Keep away from light. Swirl gently to dissolve.',
      },
    },
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
    overview: {
      whatItDoes:
        'DSIP is a small peptide isolated from rabbit brain in the 1970s, named for its ability to induce delta-wave (deep) sleep in early animal studies. The story since then has been more complicated — subsequent research has produced mixed results, and the exact mechanism remains unclear. Despite this, it\'s used by researchers and biohackers for sleep quality, stress modulation, and recovery from sleep deprivation. Most evidence is preclinical and dated; modern clinical trials are limited. The peptide is real and well-characterized; the practical effect varies considerably between users.',
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Stable up to 2 years frozen.',
        afterMixing: 'Refrigerate. Use within 30 days.',
        handling: 'Keep away from light. Swirl gently to dissolve.',
      },
    },
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
    overview: {
      whatItDoes:
        "IGF-1 LR3 is a modified form of insulin-like growth factor 1 — your body's natural growth signal that mediates many of growth hormone's anabolic effects. The \"LR3\" modification (Long Arg3) extends the half-life from minutes to about 20–30 hours and reduces binding to inhibitory carrier proteins, making it more active in tissue. Researchers and athletes use it for muscle growth, recovery, and tissue repair; effects can be substantial but so can the risks. Among peptides, IGF-1 LR3 has one of the more aggressive risk profiles — it directly drives cellular growth in many tissues, which is the source of both its benefits and its concerns.",
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Stable up to 2 years frozen.',
        afterMixing:
          'After mixing with acetic acid solution (typical solvent for IGF-1 LR3, not standard bacteriostatic water): refrigerate. Use within 30 days.',
        handling:
          'Keep away from light. Swirl gently to dissolve. Note that IGF-1 LR3 typically requires acetic acid as the diluent rather than bacteriostatic water — verify the correct solvent before reconstituting.',
      },
    },
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
    overview: {
      whatItDoes:
        'IGF-DES is another modified form of IGF-1 — specifically, it has the first three amino acids removed. The result is a shorter half-life (about 20–30 minutes) but much higher receptor affinity at the local injection site, making it act primarily where it\'s injected rather than systemically. Researchers and athletes use it for site-specific tissue effects, often injecting near a muscle group they want to target. Compared to IGF-1 LR3, it\'s shorter-acting and more localized, which some users prefer for the reduced systemic exposure. Most evidence is preclinical with limited human data.',
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Stable up to 2 years frozen.',
        afterMixing:
          'After mixing with acetic acid solution: refrigerate. Use within 30 days.',
        handling:
          'Keep away from light. Swirl gently to dissolve. Like IGF-1 LR3, IGF-DES typically requires acetic acid rather than bacteriostatic water — verify before reconstituting.',
      },
    },
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
    overview: {
      whatItDoes:
        'MGF (Mechano Growth Factor) is a variant of IGF-1 your muscles release when stressed — it signals satellite cells to multiply and repair muscle damage. The "PEG" prefix means it\'s been attached to a polyethylene glycol molecule, which extends the half-life from minutes to days, making it practical to use. Researchers focus on muscle recovery, repair from injury, and athletic performance. Most evidence is preclinical; human data is limited.',
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Stable up to 2 years frozen.',
        afterMixing:
          'Refrigerate. Use within 14 days — PEG-MGF is less stable than many peptides post-reconstitution.',
        handling: 'Keep away from light. Swirl gently to dissolve.',
      },
    },
  },
};
