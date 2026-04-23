// Seed peptide catalog — ported from prototype tokens.js PEPTIDES.
// Spec §12 requires 40+ at launch; Phase 1 ships these 6.

export type Peptide = {
  id: string;
  name: string;
  subtitle: string;
  formula: string;
  mw: number;
  class: string;
  halfLife: string;
  color: string;
  tags: string[];
  summary: string;
  dosing: { typical: string; freq: string; route: string };
  stacks: string[];
};

export const PEPTIDES: Peptide[] = [
  {
    id: 'bpc157',
    name: 'BPC-157',
    subtitle: 'Body Protection Compound',
    formula: 'C₆₂H₉₈N₁₆O₂₂',
    mw: 1419.5,
    class: 'Gastric',
    halfLife: '4 h',
    color: '#0A8E83',
    tags: ['Healing', 'GI', 'Joint'],
    summary:
      'A synthetic pentadecapeptide derived from a protein found in gastric juice. Studied for tissue repair, tendon/ligament recovery, and gut-barrier integrity.',
    dosing: { typical: '250–500 mcg', freq: 'Daily', route: 'SubQ' },
    stacks: ['TB-500', 'GHK-Cu'],
  },
  {
    id: 'tb500',
    name: 'TB-500',
    subtitle: 'Thymosin Beta-4 (frag)',
    formula: 'C₂₁₂H₃₅₀N₅₆O₇₈S',
    mw: 4963.4,
    class: 'Healing',
    halfLife: '2–3 d',
    color: '#C48A2E',
    tags: ['Recovery', 'Tendon', 'Angiogenesis'],
    summary:
      'A synthetic fragment of Thymosin β-4 implicated in cell migration, angiogenesis, and wound healing across soft tissues.',
    dosing: { typical: '2–5 mg', freq: '2×/week', route: 'SubQ / IM' },
    stacks: ['BPC-157'],
  },
  {
    id: 'sema',
    name: 'Semaglutide',
    subtitle: 'GLP-1 Agonist',
    formula: 'C₁₈₇H₂₉₁N₄₅O₅₉',
    mw: 4113.6,
    class: 'Metabolic',
    halfLife: '~7 d',
    color: '#2A6BB5',
    tags: ['GLP-1', 'Satiety', 'Glucose'],
    summary:
      'Long-acting glucagon-like peptide-1 receptor agonist. Modulates appetite signaling, gastric emptying, and insulin response.',
    dosing: { typical: '0.25–2.4 mg', freq: 'Weekly', route: 'SubQ' },
    stacks: ['Tirzepatide (alt)'],
  },
  {
    id: 'ipamor',
    name: 'Ipamorelin',
    subtitle: 'GHRP / Selective',
    formula: 'C₃₈H₄₉N₉O₅',
    mw: 711.85,
    class: 'Growth',
    halfLife: '~2 h',
    color: '#7A4FC9',
    tags: ['GH pulse', 'Sleep', 'Recovery'],
    summary:
      'Pentapeptide GH-releasing peptide known for its selectivity — stimulates a GH pulse with minimal effect on cortisol or prolactin.',
    dosing: { typical: '200–300 mcg', freq: '1–3×/day', route: 'SubQ' },
    stacks: ['CJC-1295', 'Mod GRF'],
  },
  {
    id: 'cjc',
    name: 'CJC-1295',
    subtitle: 'GHRH Analog',
    formula: 'C₁₅₂H₂₅₂N₄₄O₄₂',
    mw: 3367.9,
    class: 'Growth',
    halfLife: '6–8 d (DAC)',
    color: '#2A6BB5',
    tags: ['GHRH', 'GH', 'IGF-1'],
    summary:
      'Modified GHRH analog that raises baseline GH and IGF-1. Paired with a GHRP like Ipamorelin for pulsatile release.',
    dosing: { typical: '1–2 mg', freq: 'Weekly (DAC)', route: 'SubQ' },
    stacks: ['Ipamorelin'],
  },
  {
    id: 'ghkcu',
    name: 'GHK-Cu',
    subtitle: 'Copper Tripeptide',
    formula: 'C₁₄H₂₄N₆O₄·Cu',
    mw: 402.93,
    class: 'Skin',
    halfLife: '~1 h',
    color: '#1A8A4F',
    tags: ['Skin', 'Hair', 'Repair'],
    summary:
      'Endogenous copper-binding tripeptide. Studied for collagen synthesis, wound healing, and hair follicle signaling.',
    dosing: { typical: '1–2 mg', freq: 'Daily', route: 'SubQ / Topical' },
    stacks: ['BPC-157'],
  },
];

export const PEPTIDE_CLASSES = ['All', 'Healing', 'Growth', 'Metabolic', 'Skin'];

export function findPeptide(id: string): Peptide | undefined {
  return PEPTIDES.find((p) => p.id === id);
}
