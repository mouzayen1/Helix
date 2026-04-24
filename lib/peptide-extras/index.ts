// Unified peptide-extras registry. Each class file exports a map; we merge them.
import { HEALING_EXTRAS } from './healing';
import { IMMUNE_EXTRAS } from './immune';
import { GROWTH_EXTRAS } from './growth';
import { METABOLIC_EXTRAS } from './metabolic';
import { COGNITIVE_EXTRAS } from './cognitive';
import { LONGEVITY_EXTRAS } from './longevity';
import { MISC_EXTRAS } from './misc';
import type { PeptideExtras, PeptideExtrasMap } from './types';

export type { CoAdmin, CycleTemplate, PeptideExtras, PeptideExtrasMap, StackConflict } from './types';

export const PEPTIDE_EXTRAS: PeptideExtrasMap = {
  ...HEALING_EXTRAS,
  ...IMMUNE_EXTRAS,
  ...GROWTH_EXTRAS,
  ...METABOLIC_EXTRAS,
  ...COGNITIVE_EXTRAS,
  ...LONGEVITY_EXTRAS,
  ...MISC_EXTRAS,
};

export function getPeptideExtras(peptide_id: string): PeptideExtras | undefined {
  return PEPTIDE_EXTRAS[peptide_id];
}
