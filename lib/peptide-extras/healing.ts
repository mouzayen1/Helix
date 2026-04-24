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
  },
};
