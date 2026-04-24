import type { PeptideExtrasMap } from './types';

export const IMMUNE_EXTRAS: PeptideExtrasMap = {
  kpv: {
    benefits:
      'Lys-Pro-Val C-terminal tripeptide of α-MSH. Studied for anti-inflammatory effects in IBD / ulcerative colitis models and skin inflammation.',
    beginnerProtocol:
      'Research protocols commonly oral (enteric-coated) 250–500 mcg/day or SubQ 200–500 mcg/day. Limited human data.',
    cycleTemplate: {
      duration_weeks: 6,
      phase_notes: 'Continuous 4–8 weeks during active inflammation context; taper on improvement.',
      schedule: '500 mcg SubQ or oral once daily for 6 weeks.',
    },
    timing: 'Morning with food if oral. SubQ no strong preference.',
    coAdministration: [
      { peptide_id: 'bpc157', note: 'GI inflammation + healing rationale' },
    ],
    stackConflicts: [],
  },

  ta1: {
    benefits:
      'Thymosin Alpha-1 (Zadaxin®). Approved in ~35 countries as an immune modulator; studied for chronic hepatitis B/C, sepsis, and as adjunct to vaccination in older adults.',
    beginnerProtocol:
      'Clinical protocols: 1.6 mg SubQ twice weekly (hepatitis indication) or 0.9 mg/m² schedules.',
    cycleTemplate: {
      duration_weeks: 12,
      phase_notes: 'Long cycles common in clinical hepatitis studies (6–12 months).',
      schedule: '1.6 mg SubQ twice weekly (e.g., Monday + Thursday) for 12 weeks.',
    },
    timing: 'Consistent day-of-week scheduling supports adherence.',
    coAdministration: [],
    stackConflicts: [],
  },

  ll37: {
    benefits:
      'Human cathelicidin antimicrobial peptide. Research focus: antimicrobial activity across bacterial, fungal, and viral pathogens; wound-healing and vitamin-D regulated immunity.',
    beginnerProtocol:
      'No standardized human dosing. Research protocols are highly variable; SubQ microgram-range dosing in some antimicrobial research.',
    cycleTemplate: {
      duration_weeks: 4,
      phase_notes: 'Short courses; no long-term human data.',
      schedule: 'Limited human data — research range only, do not self-prescribe.',
    },
    timing: 'Research protocols vary; no established timing.',
    coAdministration: [],
    stackConflicts: [],
  },
};
