import type { PeptideExtrasMap } from './types';

// GHRP / GHRH class. Most real-world protocols pair a GHRP (ipamor/ghrp2/ghrp6/hexar)
// with a GHRH (cjc / sermorelin / tesamorelin) to drive pulsatile GH release.

export const GROWTH_EXTRAS: PeptideExtrasMap = {
  ipamor: {
    benefits:
      'Selective pentapeptide GH secretagogue. Stimulates a GH pulse with minimal effect on cortisol or prolactin. Research on IGF-1 elevation, sleep quality, recovery.',
    beginnerProtocol:
      'Research protocols start at 100–200 mcg per dose, 1–3× daily. Typical target 200–300 mcg per pulse. 5-days-on / 2-off schedule preserves receptor sensitivity across long cycles.',
    cycleTemplate: {
      duration_weeks: 12,
      phase_notes: 'Pulsatile dosing to preserve receptor sensitivity. 5-days-on / 2-off is the common pattern in research.',
      schedule: '200–300 mcg SubQ up to 3× daily (AM, post-workout, pre-bed). 5 days on, 2 off, for 12 weeks.',
      phases: [
        { name: 'Active (5-on / 2-off)', weeks: 12, dose_modifier: '200–300 mcg SubQ, up to 3×/day, 5 days on + 2 days off' },
      ],
    },
    timing:
      'Pre-bed dose aligns with natural GH pulse. Empty stomach preferred (no carb/fat within 2 hours) to avoid blunting GH release.',
    coAdministration: [
      { peptide_id: 'cjc_nodac', note: 'Classic GHRP + GHRH pairing. Separate vials, co-injected for pulsatile + baseline GH.' },
      { peptide_id: 'cjc_dac', note: 'Same rationale; DAC gives constant elevation instead of pulsatile.' },
      { peptide_id: 'sermor', note: 'GHRP + GHRH pairing, sermorelin is shorter-acting GHRH.' },
      { peptide_id: 'tesamor', note: 'GHRP + stabilized GHRH pairing.' },
    ],
    stackConflicts: [
      { peptide_id: 'ghrp2', reason: 'Multiple GHRPs cause ghrelin receptor desensitization.' },
      { peptide_id: 'ghrp6', reason: 'Multiple GHRPs cause ghrelin receptor desensitization.' },
      { peptide_id: 'hexar', reason: 'Multiple GHRPs cause ghrelin receptor desensitization.' },
      { peptide_id: 'mk677', reason: 'MK-677 is a long-acting ghrelin agonist; stacking causes constant over-stimulation.' },
    ],
    commonMistakes: [
      'Eating within 2 hours of a dose — carbs/fat blunt the GH pulse by raising somatostatin.',
      'Running a continuous daily schedule longer than 8 weeks without 2-off days; receptor sensitivity drops.',
    ],
    proTips: [
      'Pre-bed dose stacks on the natural slow-wave-sleep GH pulse — this is why users report better sleep subjectively.',
      'Pair with CJC-1295 (no DAC) in separate vials, injected at the same time, for the GHRH + GHRP synergy.',
    ],
  },

  cjc_nodac: {
    benefits:
      'GHRH analog (Mod GRF 1-29) with short half-life (~30 min). Pairs with a GHRP to drive large pulsatile GH release without affecting pulse architecture.',
    beginnerProtocol:
      'Research protocols: 100 mcg SubQ per pulse, 1–3× daily, co-injected with a GHRP like Ipamorelin. 5-on/2-off schedule mirrors the paired GHRP.',
    cycleTemplate: {
      duration_weeks: 12,
      phase_notes: 'Same cadence as the paired GHRP (usually Ipamorelin). 5-days-on / 2-off preserves receptor sensitivity.',
      schedule: '100 mcg SubQ + 200–300 mcg Ipamorelin SubQ up to 3× daily, 5-on/2-off, 12 weeks.',
      phases: [
        { name: 'Active (5-on / 2-off)', weeks: 12, dose_modifier: '100 mcg SubQ per pulse, co-injected with Ipamorelin, 5 days on + 2 days off' },
      ],
    },
    timing: 'Same as the paired GHRP — pre-bed, AM, and/or post-workout, empty stomach.',
    coAdministration: [
      { peptide_id: 'ipamor', note: 'Canonical GHRH + GHRP pairing.' },
      { peptide_id: 'ghrp2', note: 'GHRP-2 pairing (more appetite increase).' },
      { peptide_id: 'ghrp6', note: 'GHRP-6 pairing (strong appetite increase).' },
      { peptide_id: 'hexar', note: 'Hexarelin pairing (potent GH release).' },
    ],
    stackConflicts: [
      { peptide_id: 'cjc_dac', reason: 'Two GHRH analogs at once — redundant, receptor desensitization risk.' },
      { peptide_id: 'sermor', reason: 'Two GHRH analogs — redundant.' },
      { peptide_id: 'tesamor', reason: 'Two GHRH analogs — redundant.' },
    ],
  },

  cjc_dac: {
    benefits:
      'GHRH analog with drug-affinity complex (albumin-binding). Long half-life (~6–8 days) gives baseline GH/IGF-1 elevation instead of pulsatile release.',
    beginnerProtocol:
      'Research protocols: 1–2 mg SubQ once or twice weekly.',
    cycleTemplate: {
      duration_weeks: 12,
      phase_notes: 'Weekly dosing; IGF-1 rises after 2–3 weeks and plateaus. 12-week cycles common.',
      schedule: '1 mg SubQ weekly (e.g., Sunday evening) for 12 weeks, with 4-week wash-out.',
    },
    timing: 'Consistent day each week. Pre-bed on injection night is common in research.',
    coAdministration: [
      { peptide_id: 'ipamor', note: 'Baseline GHRH (DAC) + pulsatile GHRP (Ipamorelin) pattern.' },
    ],
    stackConflicts: [
      { peptide_id: 'cjc_nodac', reason: 'Two GHRH analogs — redundant.' },
      { peptide_id: 'sermor', reason: 'Two GHRH analogs — redundant.' },
      { peptide_id: 'tesamor', reason: 'Two GHRH analogs — redundant.' },
      { peptide_id: 'mk677', reason: 'Both produce constant GH stimulation; compounding desensitization risk.' },
    ],
  },

  sermor: {
    benefits:
      'GRF(1-29) — native GHRH fragment. Short half-life; promotes natural pulsatile GH release. Historically used in pediatric GH deficiency diagnostics.',
    beginnerProtocol:
      'Research protocols: 200–500 mcg SubQ once daily, usually pre-bed.',
    cycleTemplate: {
      duration_weeks: 12,
      phase_notes: 'Long cycles; IGF-1 rises slowly.',
      schedule: '300 mcg SubQ pre-bed, 5 days on / 2 off, for 12 weeks.',
    },
    timing: 'Pre-bed, empty stomach (no carb/fat within 2 hours).',
    coAdministration: [
      { peptide_id: 'ipamor', note: 'GHRH + GHRP pairing.' },
    ],
    stackConflicts: [
      { peptide_id: 'cjc_nodac', reason: 'Same GHRH mechanism class — redundant.' },
      { peptide_id: 'cjc_dac', reason: 'Same mechanism — redundant.' },
      { peptide_id: 'tesamor', reason: 'Same mechanism — redundant.' },
    ],
  },

  tesamor: {
    benefits:
      'Stabilized GHRH analog (Egrifta®). FDA-approved for HIV-associated lipodystrophy. Long-term elevation of GH/IGF-1 with established trial safety data.',
    beginnerProtocol:
      'Label dose: 2 mg SubQ once daily. Clinical titration: 1–2 mg/day. Some research protocols use 5-on/2-off scheduling for extended cycles beyond 8 weeks.',
    cycleTemplate: {
      duration_weeks: 26,
      phase_notes: 'Approved label supports 6+ month continuous dosing. Research contexts sometimes use 5-on/2-off after week 8 for receptor preservation.',
      schedule: '2 mg SubQ daily for 8 weeks, then optionally 5-on/2-off for weeks 9+. Long-term; evaluate IGF-1 periodically.',
      phases: [
        { name: 'Daily', weeks: 8, dose_modifier: '2 mg SubQ once daily' },
        { name: 'Maintenance (5-on / 2-off)', weeks: 18, dose_modifier: '2 mg SubQ, 5 days on + 2 days off' },
      ],
    },
    timing: 'Evening dosing in the label.',
    coAdministration: [
      { peptide_id: 'ipamor', note: 'GHRH + GHRP pairing (off-label context).' },
    ],
    stackConflicts: [
      { peptide_id: 'cjc_nodac', reason: 'Redundant GHRH.' },
      { peptide_id: 'cjc_dac', reason: 'Redundant GHRH.' },
      { peptide_id: 'sermor', reason: 'Redundant GHRH.' },
    ],
  },

  hexar: {
    benefits:
      'Potent GHRP; reports strongest GH release among classical GHRPs, but prolactin/cortisol side-effects and receptor desensitization are more pronounced.',
    beginnerProtocol:
      'Research protocols: 100 mcg per dose, 1–2× daily. Short cycles (<6 weeks) to avoid desensitization.',
    cycleTemplate: {
      duration_weeks: 4,
      phase_notes: 'Short cycle (4–6 weeks) with long wash-out (≥4 weeks) due to desensitization.',
      schedule: '100 mcg SubQ twice daily (AM + pre-bed) for 4 weeks.',
    },
    timing: 'AM and pre-bed, empty stomach.',
    coAdministration: [
      { peptide_id: 'cjc_nodac', note: 'GHRP + GHRH pairing.' },
    ],
    stackConflicts: [
      { peptide_id: 'ipamor', reason: 'Multiple GHRPs — desensitization risk.' },
      { peptide_id: 'ghrp2', reason: 'Multiple GHRPs — desensitization risk.' },
      { peptide_id: 'ghrp6', reason: 'Multiple GHRPs — desensitization risk.' },
      { peptide_id: 'mk677', reason: 'Compounding ghrelin-receptor stimulation.' },
    ],
  },

  ghrp2: {
    benefits:
      'Classic hexapeptide GH secretagogue. Strong GH pulse; modest prolactin/cortisol bumps; increases appetite somewhat.',
    beginnerProtocol:
      'Research protocols: 100 mcg per pulse, 2–3× daily.',
    cycleTemplate: {
      duration_weeks: 8,
      phase_notes: 'Cycle 8 weeks, 4 weeks off, to preserve sensitivity.',
      schedule: '100 mcg SubQ 3× daily (AM + post-workout + pre-bed) for 8 weeks.',
    },
    timing: 'Empty stomach; pre-bed + AM + post-workout pattern common.',
    coAdministration: [
      { peptide_id: 'cjc_nodac', note: 'GHRP + GHRH pairing.' },
    ],
    stackConflicts: [
      { peptide_id: 'ipamor', reason: 'Multiple GHRPs — desensitization.' },
      { peptide_id: 'ghrp6', reason: 'Multiple GHRPs — desensitization.' },
      { peptide_id: 'hexar', reason: 'Multiple GHRPs — desensitization.' },
      { peptide_id: 'mk677', reason: 'Compounding ghrelin agonism.' },
    ],
  },

  ghrp6: {
    benefits:
      'Hexapeptide GH secretagogue with strong appetite-stimulating side effect (popular in bulking research contexts). Less selective than Ipamorelin.',
    beginnerProtocol:
      'Research protocols: 100 mcg per pulse, 2–3× daily.',
    cycleTemplate: {
      duration_weeks: 8,
      phase_notes: 'Cycle 8 weeks, 4 weeks off.',
      schedule: '100 mcg SubQ 3× daily, empty stomach, for 8 weeks.',
    },
    timing: 'Empty stomach. Pre-workout + pre-bed common if appetite stimulation is desired.',
    coAdministration: [
      { peptide_id: 'cjc_nodac', note: 'GHRP + GHRH pairing.' },
    ],
    stackConflicts: [
      { peptide_id: 'ipamor', reason: 'Multiple GHRPs — desensitization.' },
      { peptide_id: 'ghrp2', reason: 'Multiple GHRPs — desensitization.' },
      { peptide_id: 'hexar', reason: 'Multiple GHRPs — desensitization.' },
      { peptide_id: 'mk677', reason: 'Compounding ghrelin agonism.' },
    ],
  },

  mk677: {
    benefits:
      'Oral ghrelin-receptor agonist (non-peptide). Produces sustained 24-hour GH/IGF-1 elevation. Research on lean body mass, sleep, appetite; long-term insulin-sensitivity changes reported.',
    beginnerProtocol:
      'Research protocols: 10–25 mg PO once daily.',
    cycleTemplate: {
      duration_weeks: 12,
      phase_notes: 'Long cycles. Monitor appetite, water retention, fasting glucose.',
      schedule: '25 mg PO once daily (evening), for 12 weeks, then 4-week break.',
    },
    timing: 'Evening dosing — reported to improve subjective sleep quality.',
    coAdministration: [],
    stackConflicts: [
      { peptide_id: 'ipamor', reason: 'Compounding ghrelin-receptor stimulation.' },
      { peptide_id: 'ghrp2', reason: 'Compounding ghrelin-receptor stimulation.' },
      { peptide_id: 'ghrp6', reason: 'Compounding ghrelin-receptor stimulation.' },
      { peptide_id: 'hexar', reason: 'Compounding ghrelin-receptor stimulation.' },
      { peptide_id: 'cjc_dac', reason: 'Both produce constant GH elevation — over-stimulation.' },
    ],
  },
};
