import type { PeptideExtrasMap } from './types';

export const HEALING_EXTRAS: PeptideExtrasMap = {
  bpc157: {
    benefits:
      'Studied for tissue repair, tendon/ligament healing, and GI protection. Pre-clinical literature reports angiogenic and cyto-protective effects across many injury models; most evidence is rodent or in-vitro.',
    beginnerProtocol:
      'Published research protocols start at 200–250 mcg/day once or twice daily. No standardized human titration exists; dose-ranging rodent studies span 10 mcg/kg to 500 mcg/kg.',
    cycleTemplate: {
      duration_weeks: 4,
      phase_notes:
        'Most published protocols run 4–6 weeks continuous. Short half-life (~15–30 min) makes twice-daily dosing common.',
      schedule: '250 mcg SubQ twice daily (morning + evening) for 4–6 weeks, then pause and reassess.',
    },
    timing:
      'No strong timing requirement. Twice-daily spacing (e.g., 8am + 8pm) is common in research to compensate for the short plasma half-life.',
    coAdministration: [
      { peptide_id: 'tb500', note: 'Classic healing pair; reconstitution-compatible (same BAC, same SubQ site)', co_reconstitute: true },
      { peptide_id: 'ghkcu', note: 'Skin + soft-tissue healing synergy; separate vials, SubQ' },
      { peptide_id: 'pda', note: 'Same 15-aa sequence with arginate counter-ion — do not stack both; alternate' },
      { peptide_id: 'kpv', note: 'GI tract inflammation + healing (research contexts)' },
    ],
    stackConflicts: [],
    commonMistakes: [
      'Single-daily dosing despite the 15–30 min plasma half-life — splitting into AM + PM maintains exposure.',
      'Injecting systemically when targeting a local tendon — research suggests proximity to the injury site helps.',
    ],
    proTips: [
      'Reconstitute-compatible with TB-500 at the same BAC volume for a single co-administered shot.',
      'Short half-life forgives missed doses — just resume the next scheduled dose rather than double-up.',
    ],
    sideEffects: [
      'Mild injection-site irritation or transient redness',
      'Occasional dizziness or lightheadedness shortly after dosing',
      'Headache and mild fatigue reported in research subjects',
      'Long-term human safety data is limited — most evidence is rodent / in-vitro',
    ],
    contraindications: [
      'Active malignancy (pre-clinical angiogenic activity is a theoretical concern)',
      'Pregnancy and breastfeeding (no human safety data)',
    ],
    overview: {
      whatItDoes:
        'BPC-157 is a small protein fragment originally found in human stomach acid, where it helps protect and repair the gut lining. Researchers synthesized it as a standalone compound to study its healing effects on tendons, ligaments, joints, and the digestive tract. In animal studies, it shows strong tissue-repair activity — speeding recovery from tears, ulcers, and inflammation. Most evidence is preclinical (animal models); human clinical trials are limited but anecdotal reports from athletes and researchers are extensive.',
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Freeze for long-term storage — stable up to 2 years frozen, 1 year refrigerated.',
        afterMixing: 'Keep refrigerated. Use within 30 days.',
        handling:
          "Keep away from light. Don't shake the vial — swirl gently to dissolve. Avoid temperature swings.",
      },
    },
  },

  tb500: {
    benefits:
      'Thymosin β4 fragment studied for actin-cytoskeleton regulation, cell migration to injury sites, MMP-2 upregulation, and capillary density. Used in research on tendon, dermal, and cardiac repair.',
    beginnerProtocol:
      'Research protocols: loading 3 mg SubQ twice weekly for 2 weeks, then 1.5–2.5 mg once weekly maintenance. WADA-prohibited for athletes.',
    cycleTemplate: {
      duration_weeks: 8,
      phase_notes: 'Two-phase structure: aggressive loading for 2 weeks, then step down to weekly maintenance for 6 weeks. Wash-out 4 weeks between cycles.',
      schedule: 'Loading (weeks 1–2): 3 mg SubQ 2× weekly. Maintenance (weeks 3–8): 1.5–2.5 mg SubQ once weekly.',
      phases: [
        { name: 'Loading', weeks: 2, dose_modifier: '3 mg SubQ 2× weekly' },
        { name: 'Maintenance', weeks: 6, dose_modifier: '1.5–2.5 mg SubQ once weekly' },
      ],
    },
    timing:
      'Injection timing is not time-of-day sensitive. Same day each week helps protocol adherence during maintenance.',
    coAdministration: [
      { peptide_id: 'bpc157', note: 'Classic healing pair; co-reconstitute possible', co_reconstitute: true },
      { peptide_id: 'ghkcu', note: 'Broader tissue-repair coverage' },
    ],
    stackConflicts: [],
    commonMistakes: [
      'Skipping the loading phase and running straight to maintenance dosing — under-dosed for the first month.',
      'Running cycles back-to-back without a wash-out period.',
    ],
    proTips: [
      'Co-reconstitute with BPC-157 in the same BAC for a single SubQ shot when running the classic healing pair.',
      'Inject into the nearest site to the injury when treating localized tendon/ligament issues (research convention; systemic effects still dominate).',
    ],
    sideEffects: [
      'Transient fatigue or "head-fog" during the loading phase',
      'Injection-site reactions (redness, mild swelling)',
      'Mild flu-like sensation in the first week reported anecdotally',
      'WADA-prohibited — disqualifying in-competition for athletes',
    ],
    contraindications: [
      'Active or recent cancer (systemic angiogenesis is undesirable)',
      'Pregnancy and breastfeeding',
      'Athletes subject to WADA testing',
    ],
    overview: {
      whatItDoes:
        "TB-500 is a synthetic version of a fragment from Thymosin Beta-4, a protein your body makes naturally to help cells move where they're needed for healing. Think of it as your body's repair-crew dispatcher — it tells damaged-area cells to multiply and migrate to injuries. Research focuses on muscle recovery, tendon healing, and reducing inflammation. Most studies are in animals (especially horses, where it's used widely in racing). Human data is limited but increasingly explored for soft-tissue injuries.",
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Freeze for long-term storage — stable up to 2 years frozen, 6 months refrigerated.',
        afterMixing:
          'Refrigerate. Use within 30 days. Some users freeze pre-drawn syringes for longer storage; potency may degrade.',
        handling: 'Keep away from light. Swirl gently — never shake.',
      },
    },
  },

  tb4_full: {
    benefits:
      'Endogenous full-length 43-aa Thymosin β4. Retains multiple functional domains beyond the actin-binding motif; investigated for corneal healing, cardiac repair, neurological protection.',
    beginnerProtocol:
      'Human clinical trials exist for corneal and venous-stasis indications; protocols vary widely (2–10 mg range, 2–3× weekly).',
    cycleTemplate: {
      duration_weeks: 6,
      phase_notes: 'Short cycles; human-trial protocols cap at ~6–8 weeks.',
      schedule: '5 mg SubQ 2× weekly for 6 weeks.',
    },
    timing: 'No strong timing preference.',
    coAdministration: [
      { peptide_id: 'bpc157', note: 'Overlap with TB-500 pairing rationale' },
      { peptide_id: 'ghkcu', note: 'Complementary tissue-repair pathways' },
    ],
    stackConflicts: [
      { peptide_id: 'tb500', reason: 'TB-500 is a fragment of this peptide — redundant to stack both' },
    ],
    sideEffects: [
      'Injection-site reactions',
      'Transient fatigue early in the course',
      'WADA-prohibited (full-length thymosin β4)',
    ],
    contraindications: [
      'Active malignancy',
      'Pregnancy and breastfeeding',
    ],
  },

  ghkcu: {
    benefits:
      'Endogenous copper-binding tripeptide implicated in collagen + elastin synthesis, SOD activation, angiogenesis, nerve outgrowth. Strongest evidence is dermatologic / wound-healing; also modulates >4,000 genes in genomic studies.',
    beginnerProtocol:
      'Topical: 0.05–2% w/w once or twice daily — best-evidenced route. SubQ: 1–2 mg daily in research protocols.',
    cycleTemplate: {
      duration_weeks: 8,
      phase_notes: 'Topical can be continuous. SubQ cycles usually 6–12 weeks.',
      schedule: '1 mg SubQ daily for 8 weeks, OR topical formulation 1–2× daily continuous.',
    },
    timing: 'SubQ: consistent time each day. Topical: morning and/or evening after cleansing.',
    coAdministration: [
      { peptide_id: 'bpc157', note: 'Healing + skin synergy; separate vials SubQ' },
      { peptide_id: 'tb500', note: 'Broader tissue-repair coverage' },
    ],
    stackConflicts: [],
    sideEffects: [
      'Topical: mild stinging or redness; rare contact dermatitis',
      'SubQ: injection-site reactions, transient bruising',
      'Copper accumulation theoretical with long-term high-dose use',
    ],
    contraindications: [
      'Wilson disease or copper-overload conditions',
      'Pregnancy and breastfeeding (no human safety data for SubQ use)',
    ],
    overview: {
      whatItDoes:
        'GHK-Cu is a tripeptide naturally found in your blood that binds to copper to form a small healing complex. It signals your body to repair tissue, produce collagen, and reduce inflammation. Levels naturally drop with age — roughly 60–70% lower at 60 than at 20 — which researchers think contributes to slower healing as we get older. Most often used topically for skin (it\'s well-established in skincare research) but also injected for systemic healing, hair regrowth, and tissue repair. Strong skin/topical evidence; injected use has more limited human data.',
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Protect from light — copper peptides are particularly light-sensitive.',
        afterMixing:
          'Refrigerate. Use within 30 days. The solution typically has a blue or green tint — this is the copper, not contamination.',
        handling: 'Topical preparations: follow product-specific storage instructions.',
      },
    },
  },

  pda: {
    benefits:
      'Arginate-salt form of BPC-157. Proposed to offer improved stability and shelf-life; emerged in response to compounding restrictions on BPC-157. Head-to-head human PK comparisons not yet published.',
    beginnerProtocol:
      'Mirrors BPC-157 research dosing: 250–500 mcg/day, SubQ, once or twice daily.',
    cycleTemplate: {
      duration_weeks: 4,
      phase_notes: 'Same as BPC-157 protocols.',
      schedule: '250 mcg SubQ twice daily for 4–6 weeks.',
    },
    timing: 'Twice daily spacing preferred, as with BPC-157.',
    coAdministration: [
      { peptide_id: 'tb500', note: 'Same pairing rationale as BPC-157 + TB-500' },
      { peptide_id: 'ghkcu', note: 'Healing + skin synergy' },
    ],
    stackConflicts: [
      { peptide_id: 'bpc157', reason: 'Same peptide sequence — stacking both is redundant' },
    ],
    sideEffects: [
      'Mirrors BPC-157: mild injection-site irritation, occasional dizziness',
      'Headache and mild fatigue reported anecdotally',
      'Long-term human safety data is limited',
    ],
    contraindications: [
      'Active malignancy',
      'Pregnancy and breastfeeding',
    ],
  },
};
