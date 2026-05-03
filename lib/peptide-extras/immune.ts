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
    sideEffects: [
      'Mild GI upset (oral route)',
      'Injection-site reactions (SubQ route)',
      'Limited long-term human safety data',
    ],
    contraindications: [
      'Pregnancy and breastfeeding',
      'Known autoimmune flare during dosing — limited data on bidirectional effects',
    ],
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
    sideEffects: [
      'Injection-site reactions (most common trial finding)',
      'Mild flu-like symptoms early in a course',
      'Hypersensitivity reactions are rare but reported',
    ],
    contraindications: [
      'Active immunosuppressive therapy (theoretical antagonism)',
      'Pregnancy and breastfeeding',
      'Known hypersensitivity to thymic peptides',
    ],
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
    sideEffects: [
      'Pro-inflammatory at higher doses (LL-37 is a host-defense peptide)',
      'Injection-site reactions; potential for local irritation',
      'Limited human safety data outside research settings',
    ],
    contraindications: [
      'Active autoimmune flare (pro-inflammatory potential)',
      'Pregnancy and breastfeeding',
      'No standardized human use protocol',
    ],
  },
};
