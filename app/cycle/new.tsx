// New cycle wizard — editorial rebuild. Same 4-step flow:
//   1. Goal     2. Template     3. Customize     4. Review
// with the same data flow (template prefill, copy-from-cycle prefill,
// conflict guard, conditional skip past step 2 for "Custom" goal).
// Visual layer: hairline-divided lists, EyebrowLabel sections, serif
// numerals for the dose stepper, EditorialButton + Stepper helpers.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { HairlineRow } from '../../components/editorial/HairlineRow';
import { useEditorialTheme, type EditorialTheme } from '../../lib/design/theme';
import { DosingDisclaimer } from '../../components/Primitives';
import { PEPTIDES, findPeptide } from '../../lib/peptides';
import { getPeptideExtras } from '../../lib/peptide-extras';
import {
  attachVialToCycle,
  createCycle,
  dismissBanner,
  listCycles,
  matchingVialsForCycle,
  parseDismissedBanners,
  type CycleProtocolItem,
  type CycleProtocolItemPhase,
  type Vial,
} from '../../lib/db';
import { useDoseUnitPref, useProfile } from '../../lib/profile-context';
import { DoseInputUnitChip, DoseValue } from '../../components/editorial/DoseUnitChip';
import {
  formatDose,
  formatDoseLabel,
  parseDoseInput,
  resolveDoseUnit,
  type DoseUnit,
} from '../../lib/dose-format';

type Phase = 'loading' | 'active' | 'taper' | 'washout';

type Template = {
  id: string;
  goal: string;
  name: string;
  duration_weeks: number;
  phase: Phase;
  description: string;
  items: CycleProtocolItem[];
  /** 2-4 short outcome bullets — what this stack is researched for. */
  benefits: string[];
  /** 2-4 short side-effect bullets in plain language. */
  sideEffects: string[];
  /** One-line ramp-up guidance, optional for templates that don't titrate. */
  rampUp?: string;
  /** Pin to the top of the goal section. */
  popular?: boolean;
};

type Goal = {
  id: string;
  subtitle: string;
};

const SCRATCH_ID = '__scratch__';
const MAX_START_OFFSET = 30;
// Allow backdating a cycle that's already underway (e.g. logging one that
// started a couple weeks ago). The edit screen already permits arbitrary
// past starts_on, so this just brings creation-time parity.
const MIN_START_OFFSET = -90;

const GOALS: Goal[] = [
  { id: 'Healing', subtitle: 'Tendons, gut, skin' },
  { id: 'Growth', subtitle: 'GH / IGF-1 axis' },
  { id: 'Fat-loss', subtitle: 'GLP-1, lipolytic' },
  { id: 'Cognitive', subtitle: 'Focus, anxiolytic' },
  { id: 'Longevity', subtitle: 'Mitochondria, pineal' },
  { id: 'Custom', subtitle: 'Build from scratch' },
];

const FREQ_OPTIONS: string[] = [
  'daily',
  'twice daily',
  'every other day',
  'twice weekly',
  'weekly',
  '5 on / 2 off',
  '4 on / 3 off',
];

// Pulls a canonical freq string out of a peptide-extras dose_modifier
// like "5 days on + 2 days off, 100 mcg SubQ" or "0.6 mg SubQ daily".
// Falls back to the cycle template's base freq if no keyword matches.
function deriveFreqFromModifier(modifier: string | undefined, fallback: string): string {
  const m = (modifier ?? '').toLowerCase();
  if (/\b\d+\s*[-/]?\s*(days?\s*)?on\b.*\b\d+\s*[-/]?\s*(days?\s*)?off\b/.test(m)) {
    const match = m.match(/(\d+)\s*[-/]?\s*(?:days?\s*)?on\b[^a-z0-9]*?(\d+)\s*[-/]?\s*(?:days?\s*)?off/);
    if (match) return `${match[1]} on / ${match[2]} off`;
  }
  if (m.includes('twice daily') || /\b2\s*[x×]\s*daily/.test(m)) return 'twice daily';
  if (m.includes('every other day') || m.includes('eod')) return 'every other day';
  if (m.includes('twice weekly') || /\b2\s*[x×]\s*weekly/.test(m)) return 'twice weekly';
  if (m.includes('weekly')) return 'weekly';
  if (m.includes('daily') || m.includes('per day')) return 'daily';
  return fallback;
}

// Parses the FIRST mg/mcg quantity out of a dose_modifier string,
// normalizing mg → mcg. "1.7 mg SubQ weekly" → 1700. Falls back to the
// cycle template's base dose_mcg if nothing parseable is found.
function deriveDoseFromModifier(modifier: string | undefined, fallback: number): number {
  const m = (modifier ?? '').toLowerCase();
  const match = m.match(/(\d+(?:\.\d+)?)\s*(mg|mcg)\b/);
  if (!match) return fallback;
  const n = parseFloat(match[1]);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.round(match[2] === 'mg' ? n * 1000 : n);
}

const TIME_OPTIONS: string[] = ['morning', 'evening', 'pre-workout', 'pre-bed'];

const PHASE_OPTIONS: { id: Phase; label: string; desc: string }[] = [
  { id: 'loading', label: 'Loading', desc: 'Ramp-up phase' },
  { id: 'active', label: 'Active', desc: 'Main protocol' },
  { id: 'taper', label: 'Taper', desc: 'Wind-down' },
  { id: 'washout', label: 'Washout', desc: 'Rest between cycles' },
];

const TEMPLATES: Template[] = [
  // ────── HEALING ────────────────────────────────────────────────────────
  {
    id: 'healing_bpc_solo',
    goal: 'Healing',
    name: 'BPC-157 solo',
    duration_weeks: 4,
    phase: 'active',
    description: 'The simplest research-protocol entry point. 4–6 weeks SubQ.',
    popular: true,
    items: [
      { peptide_id: 'bpc157', dose_mcg: 250, freq: 'twice daily', time_of_day: 'morning' },
    ],
    benefits: [
      'Tendon, ligament, and soft-tissue repair (rodent + in-vitro evidence)',
      'GI lining protection in NSAID / IBD models',
      'Short half-life means missed doses are forgiving',
    ],
    sideEffects: [
      'Mild injection-site irritation',
      'Occasional dizziness or lightheadedness post-dose',
      'Headache and mild fatigue reported anecdotally',
    ],
    rampUp: 'No titration — start at 250 mcg twice daily and hold for the full course.',
  },
  {
    id: 'healing_classic',
    goal: 'Healing',
    name: 'BPC-157 + TB-500 (classic)',
    duration_weeks: 4,
    phase: 'active',
    description: 'Co-reconstituted healing pair. The most-run research stack.',
    popular: true,
    items: [
      { peptide_id: 'bpc157', dose_mcg: 250, freq: 'twice daily', time_of_day: 'morning' },
      { peptide_id: 'tb500', dose_mcg: 2500, freq: 'twice weekly', time_of_day: 'morning' },
    ],
    benefits: [
      'Combined angiogenic (BPC-157) + actin-cytoskeleton (TB-500) repair pathways',
      'Co-reconstitutable in the same BAC vial — single SubQ shot',
      'Standard go-to for tendon / ligament work',
    ],
    sideEffects: [
      'Both: mild injection-site reactions',
      'TB-500 loading week can bring transient fatigue',
      'WADA-prohibited (TB-500) — disqualifying for tested athletes',
    ],
    rampUp: 'TB-500 runs a 2-week loading phase (3 mg 2×/week) before maintenance.',
  },
  {
    id: 'healing_plus',
    goal: 'Healing',
    name: 'Extended healing + skin (BPC + TB + GHK-Cu)',
    duration_weeks: 6,
    phase: 'active',
    description: 'Healing pair plus copper-tripeptide for skin/scalp.',
    items: [
      { peptide_id: 'bpc157', dose_mcg: 250, freq: 'twice daily', time_of_day: 'morning' },
      { peptide_id: 'tb500', dose_mcg: 2500, freq: 'twice weekly', time_of_day: 'morning' },
      { peptide_id: 'ghkcu', dose_mcg: 1000, freq: 'daily', time_of_day: 'evening' },
    ],
    benefits: [
      'Three complementary repair pathways stacked',
      'GHK-Cu adds collagen / elastin and dermal benefits',
      '6-week duration is long enough for visible skin changes',
    ],
    sideEffects: [
      'GHK-Cu: rare contact dermatitis topically; injection-site bruising SubQ',
      'BPC + TB-500 effects as in classic stack',
      'WADA-prohibited (TB-500)',
    ],
    rampUp: 'TB-500 loads first 2 weeks; BPC + GHK-Cu run flat.',
  },
  {
    id: 'healing_ghkcu_solo',
    goal: 'Healing',
    name: 'GHK-Cu skin / scalp solo',
    duration_weeks: 8,
    phase: 'active',
    description: 'SubQ or topical copper-tripeptide for skin and hair research.',
    items: [
      { peptide_id: 'ghkcu', dose_mcg: 1000, freq: 'daily', time_of_day: 'evening' },
    ],
    benefits: [
      'Collagen + elastin synthesis, SOD activation',
      'Strongest dermatologic evidence in the catalog',
      'Topical formulations are well-evidenced and non-injectable',
    ],
    sideEffects: [
      'Topical: mild stinging or redness',
      'SubQ: injection-site bruising, transient redness',
      'Theoretical copper-accumulation concern at high chronic doses',
    ],
  },
  {
    id: 'healing_kpv_gut',
    goal: 'Healing',
    name: 'KPV — gut inflammation',
    duration_weeks: 6,
    phase: 'active',
    description: 'α-MSH C-terminal tripeptide for IBD / colitis research.',
    items: [
      { peptide_id: 'kpv', dose_mcg: 500, freq: 'daily', time_of_day: 'morning' },
    ],
    benefits: [
      'Anti-inflammatory in IBD / ulcerative-colitis models',
      'Oral or SubQ route both researched',
      'Pairs cleanly with BPC-157 if GI focus',
    ],
    sideEffects: [
      'Mild GI upset (oral)',
      'Injection-site reactions (SubQ)',
      'Limited long-term human safety data',
    ],
  },

  // ────── GROWTH ─────────────────────────────────────────────────────────
  {
    id: 'growth_classic',
    goal: 'Growth',
    name: 'Ipamorelin + CJC-1295 no-DAC (classic)',
    duration_weeks: 12,
    phase: 'active',
    description: 'Pulsatile GHRP + GHRH pair. 5-on / 2-off, 12 weeks.',
    popular: true,
    items: [
      { peptide_id: 'ipamor', dose_mcg: 250, freq: 'twice daily', time_of_day: 'pre-bed' },
      { peptide_id: 'cjc_nodac', dose_mcg: 100, freq: 'twice daily', time_of_day: 'pre-bed' },
    ],
    benefits: [
      'Mimics a natural GH pulse — cleanest GH-secretagogue stack',
      'Pre-bed dose stacks on the slow-wave-sleep GH pulse',
      'Better sleep, recovery, and IGF-1 elevation reported in research',
    ],
    sideEffects: [
      'Head-rush / flushing post-injection',
      'Mild water retention; fingers/face puffiness',
      'Glucose drift on long cycles',
      'Hand numbness at high chronic doses',
    ],
    rampUp: 'Optional loading week at 100 mcg / pulse before stepping to 250 mcg.',
  },
  {
    id: 'growth_cjc_dac',
    goal: 'Growth',
    name: 'CJC-1295 DAC baseline',
    duration_weeks: 12,
    phase: 'active',
    description: 'Long half-life GHRH analog. Weekly dosing for steady IGF-1.',
    items: [
      { peptide_id: 'cjc_dac', dose_mcg: 1000, freq: 'weekly', time_of_day: 'pre-bed' },
    ],
    benefits: [
      'Steady GH/IGF-1 elevation rather than pulses',
      'Weekly dosing — minimal injection burden',
      'Pairs with Ipamorelin pulses for combined effect',
    ],
    sideEffects: [
      'Sustained water retention',
      'Glucose drift; periodic monitoring is research convention',
      'Hand tingling at higher chronic doses',
      'Joint achiness on extended cycles',
    ],
  },
  {
    id: 'growth_cjc_dac_ipamor',
    goal: 'Growth',
    name: 'CJC-DAC + Ipamorelin (long + pulse)',
    duration_weeks: 12,
    phase: 'active',
    description: 'Baseline GHRH (DAC) + pulsatile GHRP. 12 weeks.',
    items: [
      { peptide_id: 'cjc_dac', dose_mcg: 1000, freq: 'weekly', time_of_day: 'pre-bed' },
      { peptide_id: 'ipamor', dose_mcg: 250, freq: 'twice daily', time_of_day: 'pre-bed' },
    ],
    benefits: [
      'Combined steady + pulsatile GH coverage',
      'Stronger IGF-1 elevation than either solo',
      'Daily injection load is lighter than no-DAC pair',
    ],
    sideEffects: [
      'Compounded water retention vs. either solo',
      'Stronger glucose drift — fasting glucose worth checking',
      'Hand numbness, joint achiness on long cycles',
    ],
  },
  {
    id: 'growth_tesamor',
    goal: 'Growth',
    name: 'Tesamorelin (FDA-approved GHRH)',
    duration_weeks: 26,
    phase: 'active',
    description: '2 mg SubQ daily. Strongest clinical evidence in the GH class.',
    items: [
      { peptide_id: 'tesamor', dose_mcg: 2000, freq: 'daily', time_of_day: 'evening' },
    ],
    benefits: [
      'FDA-approved (Egrifta®) for HIV-associated lipodystrophy',
      'Best-characterized safety data in the catalog',
      'Visceral fat + liver-fat reduction in trials',
    ],
    sideEffects: [
      'Injection-site reactions (most common label finding)',
      'Joint pain, peripheral edema, paresthesias',
      'Elevated fasting glucose / IGF-1; monitoring per label',
      'Hypersensitivity reactions including rash',
    ],
    rampUp: '5-days-on / 2-off after week 8 is research convention to preserve receptors.',
  },
  {
    id: 'growth_sermor',
    goal: 'Growth',
    name: 'Sermorelin pre-bed solo',
    duration_weeks: 12,
    phase: 'active',
    description: 'Native GHRH(1-29) pulse. Pre-bed once daily.',
    items: [
      { peptide_id: 'sermor', dose_mcg: 300, freq: 'daily', time_of_day: 'pre-bed' },
    ],
    benefits: [
      'Promotes natural pulsatile GH release',
      'Gentlest GHRH option; long history in pediatric diagnostics',
      'Single pre-bed shot — minimal protocol burden',
    ],
    sideEffects: [
      'Brief flushing post-injection',
      'Headache or lightheadedness in some users',
      'Injection-site reactions',
    ],
  },
  {
    id: 'growth_mk677',
    goal: 'Growth',
    name: 'MK-677 oral mono',
    duration_weeks: 12,
    phase: 'active',
    description: 'Once-daily oral ghrelin agonist. No injections.',
    items: [
      { peptide_id: 'mk677', dose_mcg: 25000, freq: 'daily', time_of_day: 'evening' },
    ],
    benefits: [
      'Sustained 24-hour GH/IGF-1 elevation',
      'Oral — no injections required',
      'Subjective sleep improvement reported',
    ],
    sideEffects: [
      'Pronounced appetite increase',
      'Notable water retention; puffiness',
      'Fasting glucose elevation; insulin sensitivity drift',
      'Vivid dreams; morning grogginess at higher doses',
    ],
    rampUp: '10 mg/day for the first week to assess water retention is a common research approach.',
  },

  // ────── FAT-LOSS ───────────────────────────────────────────────────────
  {
    id: 'fatloss_sema',
    goal: 'Fat-loss',
    name: 'Semaglutide titration',
    duration_weeks: 20,
    phase: 'loading',
    description: 'Wegovy® label titration. Start 0.25 mg, climb every 4 weeks.',
    popular: true,
    items: [
      { peptide_id: 'sema', dose_mcg: 250, freq: 'weekly', time_of_day: 'morning' },
    ],
    benefits: [
      'FDA-approved for chronic weight management',
      '~15% body-weight reduction at max dose in trials',
      'Cardiovascular risk reduction in T2D',
    ],
    sideEffects: [
      'Nausea, vomiting, diarrhea, constipation (worst at dose increases)',
      'Reduced appetite to the point of skipping meals',
      'Pancreatitis (rare class risk)',
      'Gallbladder disease',
    ],
    rampUp: '0.25 → 0.5 → 1.0 → 1.7 → 2.4 mg weekly, stepping every 4 weeks if tolerated.',
  },
  {
    id: 'fatloss_tirz',
    goal: 'Fat-loss',
    name: 'Tirzepatide titration',
    duration_weeks: 20,
    phase: 'loading',
    description: 'Mounjaro/Zepbound® dual GIP/GLP-1. Strongest efficacy in class.',
    popular: true,
    items: [
      { peptide_id: 'tirz', dose_mcg: 2500, freq: 'weekly', time_of_day: 'morning' },
    ],
    benefits: [
      'FDA-approved for T2D and chronic weight management',
      '~20% body-weight reduction at max dose in trials',
      'Superior A1c reduction vs. semaglutide',
    ],
    sideEffects: [
      'Same GI cluster as semaglutide: nausea, vomiting, diarrhea',
      'Decreased appetite; risk of inadequate intake',
      'Injection-site reactions',
      'Pancreatitis and gallbladder disease (class risks)',
    ],
    rampUp: '2.5 mg weekly × 4, then step up by 2.5 mg every 4 weeks to a max of 15 mg.',
  },
  {
    id: 'fatloss_reta',
    goal: 'Fat-loss',
    name: 'Retatrutide titration (investigational)',
    duration_weeks: 20,
    phase: 'loading',
    description: 'Triple GIP/GLP-1/GCG agonist. Largest weight-loss signal to date.',
    items: [
      { peptide_id: 'reta', dose_mcg: 2000, freq: 'weekly', time_of_day: 'morning' },
    ],
    benefits: [
      '~24% body-weight reduction at 48 weeks in phase-2 (largest seen)',
      'Triple agonism adds glucagon-driven energy expenditure',
    ],
    sideEffects: [
      'Strong GI cluster: nausea, vomiting, diarrhea',
      'Mild heart-rate elevation in trials',
      'Investigational — long-term safety profile not established',
    ],
    rampUp: '2 mg weekly × 4, then step up to 4, 8, 12 mg every 4 weeks.',
  },
  {
    id: 'fatloss_cagrisema',
    goal: 'Fat-loss',
    name: 'CagriSema (Sema + Cagrilintide)',
    duration_weeks: 24,
    phase: 'loading',
    description: 'GLP-1 + amylin combo. Phase-3 tested for additive weight-loss.',
    items: [
      { peptide_id: 'sema', dose_mcg: 2400, freq: 'weekly', time_of_day: 'morning' },
      { peptide_id: 'cagri', dose_mcg: 2400, freq: 'weekly', time_of_day: 'morning' },
    ],
    benefits: [
      'Phase-3 evidence for additive weight loss vs. semaglutide alone',
      'Amylin slows gastric emptying — extra satiety leverage',
      'Same injection day; separate vials',
    ],
    sideEffects: [
      'Compounded GI burden vs. semaglutide alone',
      'Decreased appetite; rapid satiety',
      'Pancreatitis and gallbladder disease (class risks)',
    ],
    rampUp: 'Match titration of paired semaglutide; step both upward together monthly.',
  },
  {
    id: 'fatloss_aod',
    goal: 'Fat-loss',
    name: 'AOD-9604 morning solo',
    duration_weeks: 12,
    phase: 'active',
    description: 'hGH 176-191 fragment. Morning, fasted, 5-on / 2-off.',
    items: [
      { peptide_id: 'aod', dose_mcg: 300, freq: 'daily', time_of_day: 'morning' },
    ],
    benefits: [
      'Marketed as fat-only loss without GH effects',
      'Cheap, simple morning protocol',
      'Pairs cleanly with fasted morning cardio',
    ],
    sideEffects: [
      'Effect size is modest — clinical trials have been mixed',
      'Injection-site reactions',
      'Mild headache or fatigue reported anecdotally',
    ],
  },
  {
    id: 'fatloss_amq',
    goal: 'Fat-loss',
    name: '5-amino-1MQ oral solo',
    duration_weeks: 12,
    phase: 'active',
    description: 'Oral NNMT inhibitor. Once daily with food.',
    items: [
      { peptide_id: 'amq', dose_mcg: 100000, freq: 'daily', time_of_day: 'morning' },
    ],
    benefits: [
      'Targets adipose NAD+ / methylation pathways',
      'Oral — no injections required',
      'Cycled 12 weeks on / 4 weeks off in research',
    ],
    sideEffects: [
      'Limited human safety data — mostly rodent studies',
      'Mild GI upset reported anecdotally',
      'Long-term effects of NNMT inhibition not characterized',
    ],
  },

  // ────── COGNITIVE ──────────────────────────────────────────────────────
  {
    id: 'cognitive_selank',
    goal: 'Cognitive',
    name: 'Selank intranasal solo',
    duration_weeks: 2,
    phase: 'active',
    description: 'Anxiolytic course, 10–14 days. Russian clinical use.',
    popular: true,
    items: [
      { peptide_id: 'selank', dose_mcg: 150, freq: 'twice daily', time_of_day: 'morning' },
    ],
    benefits: [
      'Anxiety reduction without sedation',
      'Modulates GABA + BDNF pathways',
      'Short courses; no titration needed',
    ],
    sideEffects: [
      'Mild nasal irritation',
      'Transient drowsiness in some users',
      'Long-term safety outside Russian clinical use is limited',
    ],
  },
  {
    id: 'cognitive_semax',
    goal: 'Cognitive',
    name: 'Semax intranasal solo',
    duration_weeks: 2,
    phase: 'active',
    description: 'Nootropic course, 10–14 days. Morning + early afternoon only.',
    popular: true,
    items: [
      { peptide_id: 'semax', dose_mcg: 250, freq: 'twice daily', time_of_day: 'morning' },
    ],
    benefits: [
      'BDNF upregulation, focus, neuroprotection',
      'Russian clinical use in stroke recovery',
      'No injections — intranasal only',
    ],
    sideEffects: [
      'Insomnia with late dosing — avoid evenings',
      'Nasal irritation',
      'Over-stimulation, headache, irritability in some users',
    ],
  },
  {
    id: 'cognitive_cerebro',
    goal: 'Cognitive',
    name: 'Cerebrolysin pulse course',
    duration_weeks: 3,
    phase: 'active',
    description: 'Porcine brain-peptide IM course, 20 days, 2–4×/year in research.',
    items: [
      { peptide_id: 'cerebro', dose_mcg: 10000, freq: 'daily', time_of_day: 'morning' },
    ],
    benefits: [
      'Clinical use in stroke rehab, Alzheimer disease, TBI research',
      'Pulsed course — long breaks between',
      'Strong clinical literature compared to most nootropics',
    ],
    sideEffects: [
      'Injection-site pain (IM)',
      'Sweating, dizziness, nausea reported',
      'Hot flashes / vasomotor symptoms',
      'Hypersensitivity reactions including rash',
    ],
  },
  {
    id: 'cognitive_dihexa',
    goal: 'Cognitive',
    name: 'Dihexa research course',
    duration_weeks: 4,
    phase: 'active',
    description: 'Oral angiotensin IV analog. Pre-clinical research only.',
    items: [
      { peptide_id: 'dihexa', dose_mcg: 25, freq: 'daily', time_of_day: 'morning' },
    ],
    benefits: [
      'HGF pathway activation, dendritic-spine density (rodent)',
      'Oral-active — no injections',
    ],
    sideEffects: [
      'No human safety data — research-only',
      'Pre-clinical reports indicate BBB crossing; off-target effects unknown',
    ],
  },

  // ────── LONGEVITY ──────────────────────────────────────────────────────
  {
    id: 'longevity_epi',
    goal: 'Longevity',
    name: 'Epitalon solo course',
    duration_weeks: 2,
    phase: 'active',
    description: '5–10 mg SubQ pre-bed × 10 days. Cycled 2–4×/year.',
    popular: true,
    items: [
      { peptide_id: 'epi', dose_mcg: 5000, freq: 'daily', time_of_day: 'evening' },
    ],
    benefits: [
      'Khavinson telomerase research; sleep/circadian regulation',
      'Short courses — minimal commitment',
      'Pre-bed timing aligns with pineal rhythm',
    ],
    sideEffects: [
      'Injection-site reactions',
      'Vivid dreams or shifted sleep architecture',
      'Long-term human safety outside Russian clinical literature is limited',
    ],
    rampUp: 'First course at 5 mg; subsequent courses can step to 10 mg.',
  },
  {
    id: 'longevity_motsc',
    goal: 'Longevity',
    name: 'MOTS-c weekly solo',
    duration_weeks: 12,
    phase: 'active',
    description: 'Mitochondrial-derived peptide. Weekly SubQ pre-workout.',
    items: [
      { peptide_id: 'motsc', dose_mcg: 10000, freq: 'weekly', time_of_day: 'morning' },
    ],
    benefits: [
      'Mitochondrial biogenesis and exercise capacity',
      'Insulin sensitivity in research',
      'Once-weekly dosing — minimal protocol burden',
    ],
    sideEffects: [
      'Injection-site reactions',
      'Mild fatigue or headache early in a course',
      'Long-term human safety data limited',
    ],
  },
  {
    id: 'longevity_ta1',
    goal: 'Longevity',
    name: 'Thymalin / TA-1 immune course',
    duration_weeks: 12,
    phase: 'active',
    description: 'Thymosin Alpha-1, 1.6 mg SubQ 2×/week × 12 weeks.',
    items: [
      { peptide_id: 'ta1', dose_mcg: 1600, freq: 'twice weekly', time_of_day: 'morning' },
    ],
    benefits: [
      'Approved in ~35 countries as an immune modulator',
      'Studied for chronic hepatitis, vaccination response in older adults',
      'Twice-weekly dosing; predictable scheduling',
    ],
    sideEffects: [
      'Injection-site reactions',
      'Mild flu-like symptoms early in a course',
      'Hypersensitivity reactions are rare but reported',
    ],
  },
  {
    id: 'longevity_nad',
    goal: 'Longevity',
    name: 'NAD+ injectable course',
    duration_weeks: 4,
    phase: 'loading',
    description: '100 mg SubQ 2–3×/week. Push slowly — flushing scales with rate.',
    items: [
      { peptide_id: 'nad', dose_mcg: 100000, freq: 'twice weekly', time_of_day: 'morning' },
    ],
    benefits: [
      'NAD+ / sirtuin pathway support',
      'Subjective fatigue and clarity reports',
      '2–3×/week schedule — sustainable long-term',
    ],
    sideEffects: [
      'Flushing, warmth, chest pressure during injection (rate-dependent)',
      'Nausea or queasiness with fast pushes',
      'Headache, mild dizziness',
      'Theoretical concern: NAD+ may fuel proliferation in active cancer',
    ],
    rampUp: 'Optional loading: 100 mg daily × 7 days, then step to 2–3×/week maintenance.',
  },
  {
    id: 'longevity_mito',
    goal: 'Longevity',
    name: 'SS-31 + NAD+ mitochondrial',
    duration_weeks: 12,
    phase: 'active',
    description: 'Daily SS-31 + 2–3×/week NAD+ for combined mitochondrial support.',
    items: [
      { peptide_id: 'ss31', dose_mcg: 10000, freq: 'daily', time_of_day: 'morning' },
      { peptide_id: 'nad', dose_mcg: 100000, freq: 'twice weekly', time_of_day: 'morning' },
    ],
    benefits: [
      'Two complementary mitochondrial-support pathways',
      'SS-31 trials cover heart failure, AMD, primary mitochondrial myopathy',
      'NAD+ adds sirtuin-pathway engagement',
    ],
    sideEffects: [
      'NAD+ flushing if pushed too fast',
      'SS-31 injection-site reactions, mild headache, GI upset',
      'Combined daily injection burden is heavier',
    ],
  },
];

function parseDefaultDose(dose: string): number {
  const m = dose.match(/(\d+(?:\.\d+)?)/);
  if (!m || m[1] === undefined) return 250;
  const n = parseFloat(m[1]);
  if (isNaN(n)) return 250;
  return /\bmg\b/i.test(dose) ? n * 1000 : n;
}

function defaultTimeOfDay(timing?: string): string {
  if (!timing) return 'morning';
  const s = timing.toLowerCase();
  if (s.includes('pre-bed') || s.includes('pre bed')) return 'pre-bed';
  if (s.includes('morning')) return 'morning';
  if (s.includes('evening')) return 'evening';
  return 'morning';
}

function doseStepFor(dose: number): number {
  if (dose < 100) return 10;
  if (dose < 1000) return 25;
  if (dose < 10000) return 100;
  if (dose < 100000) return 500;
  return 1000;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function isoDate(d: Date): string {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function NewCycle() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { copyFromCycleId } = useLocalSearchParams<{ copyFromCycleId?: string }>();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [goal, setGoal] = useState<string | null>(null);
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [cycleName, setCycleName] = useState<string>('My cycle');
  const [durationWeeks, setDurationWeeks] = useState<number>(4);
  const [phase, setPhase] = useState<Phase>('active');
  const [startOffset, setStartOffset] = useState<number>(0);
  const [items, setItems] = useState<CycleProtocolItem[]>([]);
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [pickerQuery, setPickerQuery] = useState<string>('');
  const [acceptConflicts, setAcceptConflicts] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [doseText, setDoseText] = useState<Record<string, string>>({});
  // Per-peptide input-mode override. Defaults to mg when current mcg ≥ 1000,
  // mcg otherwise — matches the global auto threshold so GLP-1 templates
  // open with mg-friendly entry. Local to this wizard; never touches the
  // global dose_unit_pref.
  const [doseInputMode, setDoseInputMode] = useState<Record<string, DoseUnit>>({});
  // v1.2 — template search query, matching vials surfaced at step 4,
  // and the set of vial ids the user opted to attach to this cycle.
  const [templateQuery, setTemplateQuery] = useState<string>('');
  const [matchingVials, setMatchingVials] = useState<Vial[]>([]);
  const [vialsToAttach, setVialsToAttach] = useState<Set<string>>(new Set());

  // Titration banner state. profile.dismissed_banners is the durable
  // record; bannerDismissedLocal is an optimistic flip while the DB
  // write is in flight (and after first phase edit auto-dismisses).
  const { profile } = useProfile();
  const { pref: doseUnitPref } = useDoseUnitPref();
  const [bannerDismissedLocal, setBannerDismissedLocal] = useState<boolean>(false);
  const isTitrationBannerDismissed =
    bannerDismissedLocal ||
    parseDismissedBanners(profile?.dismissed_banners).includes('titration_v1');
  const dismissTitrationBanner = (): void => {
    if (bannerDismissedLocal) return;
    setBannerDismissedLocal(true);
    dismissBanner('titration_v1').catch(() => {});
  };

  const isCustom = goal === 'Custom';

  // Pre-fill from copy-from-cycle, jumping to step 3.
  useEffect(() => {
    if (!copyFromCycleId) return;
    let cancelled = false;
    (async () => {
      const all = await listCycles();
      const src = all.find((c) => c.id === copyFromCycleId);
      if (!src || cancelled) return;
      try {
        const protocol = JSON.parse(src.protocol_json || '[]') as CycleProtocolItem[];
        setItems(protocol);
      } catch {
        setItems([]);
      }
      setCycleName(`${src.name} (copy)`);
      const startD = new Date(src.starts_on);
      const endD = new Date(src.ends_on);
      const days = Math.max(1, Math.floor((endD.getTime() - startD.getTime()) / 864e5));
      setDurationWeeks(Math.max(1, Math.round(days / 7)));
      setPhase(src.phase);
      setGoal('Custom');
      setSelectionId(SCRATCH_ID);
      setStartOffset(0);
      setStep(3);
    })();
    return () => {
      cancelled = true;
    };
  }, [copyFromCycleId]);

  const filteredTemplates = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    const inGoal = TEMPLATES.filter((tpl) => tpl.goal === goal);
    const matched = q
      ? inGoal.filter((tpl) =>
          [
            tpl.name,
            tpl.description,
            ...tpl.benefits,
            ...tpl.items.map((i) => findPeptide(i.peptide_id)?.name ?? ''),
          ]
            .join(' ')
            .toLowerCase()
            .includes(q)
        )
      : inGoal;
    // Stable sort: popular first, then original order.
    return matched.slice().sort((a, b) => {
      const ap = a.popular ? 0 : 1;
      const bp = b.popular ? 0 : 1;
      return ap - bp;
    });
  }, [goal, templateQuery]);

  const startDate = useMemo(() => addDays(new Date(), startOffset), [startOffset]);
  const endDate = useMemo(
    () => addDays(startDate, durationWeeks * 7),
    [startDate, durationWeeks]
  );

  const conflicts = useMemo(() => {
    const ids = new Set(items.map((i) => i.peptide_id));
    const pairs: { a: string; b: string; reason: string }[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      const extras = getPeptideExtras(item.peptide_id);
      if (!extras) continue;
      for (const c of extras.stackConflicts) {
        if (!ids.has(c.peptide_id)) continue;
        const key = [item.peptide_id, c.peptide_id].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({ a: item.peptide_id, b: c.peptide_id, reason: c.reason });
      }
    }
    return pairs;
  }, [items]);

  const timingGroups = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const it of items) {
      groups[it.time_of_day] = (groups[it.time_of_day] ?? 0) + 1;
    }
    return groups;
  }, [items]);

  const filteredPickerPeptides = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (q === '') return PEPTIDES;
    return PEPTIDES.filter((p) => {
      const hay = [p.name, p.subtitle, p.class].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [pickerQuery]);

  const canAdvance: boolean = (() => {
    if (step === 1) return goal !== null;
    if (step === 2) return selectionId !== null;
    if (step === 3) {
      if (items.length === 0 || cycleName.trim().length === 0) return false;
      // Block save while any phase row is invalid (empty name, duplicate
      // name within a peptide, or any other validation surfaced inline).
      for (const it of items) {
        const phases = it.phases ?? [];
        if (phases.length === 0) continue;
        const names = phases.map((p) => (p.name ?? '').trim());
        if (names.some((n) => n.length === 0)) return false;
        if (names.some((n) => n.length > 32)) return false;
        if (new Set(names).size !== names.length) return false;
      }
      return true;
    }
    if (step === 4) return !saving && (conflicts.length === 0 || acceptConflicts);
    return true;
  })();

  const applySelection = (sel: string): void => {
    if (sel === SCRATCH_ID) {
      setItems([]);
      setDurationWeeks(4);
      setPhase('active');
      setCycleName('My cycle');
      return;
    }
    const tpl = TEMPLATES.find((x) => x.id === sel);
    if (!tpl) return;
    // Auto-seed phases from peptide-extras cycleTemplate.phases when the
    // template defines >=2 phases. The wizard surfaces this as a dimmed
    // single-freq UI + an editable phase list (see ItemEditor).
    const seeded = tpl.items.map((i) => {
      const extras = getPeptideExtras(i.peptide_id);
      const tplPhases = extras?.cycleTemplate?.phases ?? [];
      if (tplPhases.length < 2) return { ...i };
      let cursor = 1;
      const phases = tplPhases.map((p) => {
        const phase = {
          startWeek: cursor,
          name: p.name,
          freq: deriveFreqFromModifier(p.dose_modifier, i.freq),
          dose_mcg: deriveDoseFromModifier(p.dose_modifier, i.dose_mcg),
        };
        cursor += p.weeks;
        return phase;
      });
      return { ...i, phases };
    });
    setItems(seeded);
    setDurationWeeks(tpl.duration_weeks);
    setPhase(tpl.phase);
    setCycleName(tpl.name);
  };

  const handleGoalSelect = (g: string): void => {
    setGoal(g);
    setSelectionId(null);
  };

  const handleBack = (): void => {
    if (step === 1) {
      if (goal !== null) {
        Alert.alert('Discard cycle?', 'Your selections will be lost.', [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => router.back() },
        ]);
      } else {
        router.back();
      }
      return;
    }
    if (step === 3 && isCustom) {
      setStep(1);
      return;
    }
    setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
  };

  const handleNext = (): void => {
    if (!canAdvance) return;
    if (step === 1) {
      if (isCustom) {
        applySelection(SCRATCH_ID);
        setSelectionId(SCRATCH_ID);
        setStep(3);
      } else {
        setStep(2);
      }
      return;
    }
    if (step === 2) {
      if (selectionId !== null) {
        applySelection(selectionId);
      }
      setStep(3);
      return;
    }
    if (step < 4) setStep((s) => (s + 1) as 1 | 2 | 3 | 4);
  };

  // Load vials whose peptide_id is in the current protocol when the user
  // reaches Review. Runs again if they bounce back to Customize and edit.
  useEffect(() => {
    if (step !== 4 || items.length === 0) return;
    let cancelled = false;
    (async () => {
      const vs = await matchingVialsForCycle({
        id: '',
        protocol_json: JSON.stringify(items),
      });
      if (cancelled) return;
      setMatchingVials(vs);
      // Default selection: every active matching vial. Users can untick
      // ones they want to keep as free inventory.
      setVialsToAttach(new Set(vs.filter((v) => v.is_active === 1).map((v) => v.id)));
    })();
    return () => {
      cancelled = true;
    };
  }, [step, items]);

  // Peptides in the protocol that have NO matching vial — flagged so the
  // user knows they'll need to reconstitute after creating the cycle.
  const peptidesWithoutVial = useMemo(() => {
    const matchedPids = new Set(matchingVials.map((v) => v.peptide_id));
    const cyclePids = Array.from(new Set(items.map((it) => it.peptide_id)));
    return cyclePids.filter((pid) => !matchedPids.has(pid));
  }, [items, matchingVials]);

  const toggleAttach = (vialId: string) => {
    setVialsToAttach((prev) => {
      const next = new Set(prev);
      if (next.has(vialId)) next.delete(vialId);
      else next.add(vialId);
      return next;
    });
  };

  const handleSave = async (): Promise<void> => {
    if (saving) return;
    if (conflicts.length > 0 && !acceptConflicts) return;
    setSaving(true);
    try {
      const cycleId = await createCycle({
        name: cycleName.trim(),
        starts_on: isoDate(startDate),
        ends_on: isoDate(endDate),
        phase,
        protocol: items,
      });
      // v1.2: attach selected vials to the freshly-created cycle.
      // Single-owner — if a vial was attached to another cycle this
      // overwrites that link, which matches the "move to new cycle"
      // intent the user expressed by checking the box here.
      for (const vid of vialsToAttach) {
        try {
          await attachVialToCycle(vid, cycleId);
        } catch (err) {
          if (__DEV__) console.warn('attachVialToCycle failed', err);
        }
      }
      router.replace('/(tabs)/stacks');
    } catch (e) {
      setSaving(false);
      const msg =
        e instanceof Error && e.message
          ? e.message
          : 'Something went wrong saving your cycle. Please try again.';
      Alert.alert('Could not save cycle', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retry', onPress: () => void handleSave() },
      ]);
    }
  };

  const addPeptide = (peptide_id: string): void => {
    if (items.some((i) => i.peptide_id === peptide_id)) return;
    const p = findPeptide(peptide_id);
    const extras = getPeptideExtras(peptide_id);
    const dose = p ? p.defaultDoseMcg ?? parseDefaultDose(p.dose) : 250;
    const time = defaultTimeOfDay(extras?.timing);
    setItems((prev) => [
      ...prev,
      { peptide_id, dose_mcg: dose, freq: 'daily', time_of_day: time },
    ]);
    setDoseText((prev) => ({ ...prev, [peptide_id]: String(dose) }));
    setShowPicker(false);
    setPickerQuery('');
  };

  const removeItem = (idx: number): void => {
    const removed = items[idx];
    setItems((prev) => prev.filter((_, i) => i !== idx));
    if (removed) {
      setDoseText((prev) => {
        const next = { ...prev };
        delete next[removed.peptide_id];
        return next;
      });
    }
  };

  const updateItem = (idx: number, patch: Partial<CycleProtocolItem>): void => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const updatePhase = (
    idx: number,
    pi: number,
    patch: Partial<CycleProtocolItemPhase>,
  ): void => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const phases = (it.phases ?? []).map((p, j) => (j === pi ? { ...p, ...patch } : p));
        return { ...it, phases };
      })
    );
    // First edit silently dismisses the titration banner; the user
    // has clearly understood they can customize.
    if (!isTitrationBannerDismissed) dismissTitrationBanner();
  };

  const addPhase = (idx: number): void => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const existing = it.phases ?? [];
        const startWeek = existing.length > 0
          ? Math.max(...existing.map((p) => p.startWeek)) + 1
          : 1;
        const phase: CycleProtocolItemPhase = {
          startWeek,
          name: `Phase ${existing.length + 1}`,
          freq: it.freq,
          dose_mcg: it.dose_mcg,
        };
        return { ...it, phases: [...existing, phase] };
      })
    );
  };

  const removePhase = (idx: number, pi: number): void => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const phases = (it.phases ?? []).filter((_, j) => j !== pi);
        // Collapsing back to <2 phases is fine — resolver falls through
        // to the legacy single-freq path automatically.
        return { ...it, phases };
      })
    );
  };

  const inputModeFor = (peptide_id: string, mcg: number): DoseUnit =>
    doseInputMode[peptide_id] ?? resolveDoseUnit(mcg, 'auto');

  const formatDoseForInput = (mcg: number, mode: DoseUnit): string =>
    formatDose(mcg, mode).value;

  const setDoseFromInput = (idx: number, peptide_id: string, raw: string): void => {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    setDoseText((prev) => ({ ...prev, [peptide_id]: cleaned }));
    const mode = inputModeFor(peptide_id, items[idx]?.dose_mcg ?? 0);
    const parsed = parseDoseInput(cleaned, mode);
    updateItem(idx, { dose_mcg: parsed ?? 0 });
  };

  const stepDoseBy = (
    idx: number,
    peptide_id: string,
    current: number,
    delta: number
  ): void => {
    const newDose = Math.max(0, current + delta);
    updateItem(idx, { dose_mcg: newDose });
    const mode = inputModeFor(peptide_id, newDose);
    setDoseText((prev) => ({ ...prev, [peptide_id]: formatDoseForInput(newDose, mode) }));
  };

  const setDoseInputModeFor = (idx: number, peptide_id: string, next: DoseUnit) => {
    setDoseInputMode((prev) => ({ ...prev, [peptide_id]: next }));
    const cur = items[idx]?.dose_mcg ?? 0;
    setDoseText((prev) => ({ ...prev, [peptide_id]: formatDoseForInput(cur, next) }));
  };

  // ───────────────────────────────────────────────── render helpers

  const ProgressBar = () => (
    <View
      style={{
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 24,
        paddingTop: 8,
      }}
    >
      {[1, 2, 3, 4].map((n) => {
        const active = n <= step;
        return (
          <View
            key={n}
            style={{
              flex: 1,
              height: 2,
              backgroundColor: active ? ed.colors.brand : ed.colors.line,
            }}
          />
        );
      })}
    </View>
  );

  const StepCounter = () => (
    <Text
      style={{
        fontFamily: ed.typography.eyebrow.fontFamily,
        fontSize: ed.typography.eyebrow.fontSize,
        letterSpacing: ed.typography.eyebrow.letterSpacing,
        color: ed.colors.ink3,
        textTransform: 'uppercase',
        marginTop: 24,
      }}
    >
      Step {step} of 4
    </Text>
  );

  const Step1 = () => (
    <View>
      <View style={{ marginTop: 14 }}>
        <EditorialHeadline size="title1">{`What's your *goal*?`}</EditorialHeadline>
        <Text
          style={{
            marginTop: 8,
            fontFamily: ed.typography.bodySm.fontFamily,
            fontSize: ed.typography.bodySm.fontSize,
            lineHeight: ed.typography.bodySm.lineHeight,
            color: ed.colors.ink3,
          }}
        >
          We'll tailor templates to match.
        </Text>
      </View>
      <View style={{ marginTop: 28 }}>
        {GOALS.map((g, idx) => {
          const selected = g.id === goal;
          return (
            <View key={g.id}>
              <Pressable
                onPress={() => handleGoalSelect(g.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 18,
                  gap: 14,
                }}
              >
                <RadioDot active={selected} ed={ed} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: ed.fraunces('Fraunces_400Regular'),
                      fontSize: 22,
                      letterSpacing: -0.4,
                      color: selected ? ed.colors.ink1 : ed.colors.ink2,
                    }}
                  >
                    {g.id}
                  </Text>
                  <Text
                    style={{
                      marginTop: 2,
                      fontFamily: ed.typography.labelSm.fontFamily,
                      fontSize: ed.typography.labelSm.fontSize,
                      letterSpacing: ed.typography.labelSm.letterSpacing,
                      color: ed.colors.ink3,
                      textTransform: 'uppercase',
                    }}
                  >
                    {g.subtitle}
                  </Text>
                </View>
              </Pressable>
              {idx < GOALS.length - 1 ? <HairlineRow /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );

  const TemplateRow = ({ tpl, selected }: { tpl: Template; selected: boolean }) => (
    <Pressable
      onPress={() => setSelectionId(tpl.id)}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{
        paddingVertical: 18,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
        <RadioDot active={selected} ed={ed} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <Text
              style={{
                fontFamily: ed.fraunces('Fraunces_400Regular'),
                fontSize: 19,
                letterSpacing: -0.3,
                color: selected ? ed.colors.ink1 : ed.colors.ink2,
              }}
            >
              {tpl.name}
            </Text>
            {tpl.popular ? (
              <Text
                style={{
                  fontFamily: ed.typography.labelSm.fontFamily,
                  fontSize: ed.typography.labelSm.fontSize,
                  letterSpacing: ed.typography.labelSm.letterSpacing,
                  color: ed.colors.brand,
                  textTransform: 'uppercase',
                }}
              >
                ★ Popular
              </Text>
            ) : null}
          </View>
          <Text
            style={{
              marginTop: 4,
              fontFamily: ed.typography.bodySm.fontFamily,
              fontSize: ed.typography.bodySm.fontSize,
              lineHeight: ed.typography.bodySm.lineHeight,
              color: ed.colors.ink3,
            }}
          >
            {tpl.description}
          </Text>
          <Text
            style={{
              marginTop: 4,
              fontFamily: ed.typography.labelSm.fontFamily,
              fontSize: ed.typography.labelSm.fontSize,
              letterSpacing: ed.typography.labelSm.letterSpacing,
              color: ed.colors.ink3,
              textTransform: 'uppercase',
            }}
          >
            {tpl.duration_weeks} weeks · {tpl.phase}
          </Text>
          {/* Benefits preview — first 2 only on the card so the row stays scannable. */}
          {tpl.benefits.length > 0 ? (
            <View style={{ marginTop: 8, gap: 3 }}>
              {tpl.benefits.slice(0, 2).map((b) => (
                <Text
                  key={b}
                  style={{
                    fontFamily: ed.typography.bodySm.fontFamily,
                    fontSize: 13,
                    lineHeight: 18,
                    color: ed.colors.ink2,
                  }}
                >
                  · {b}
                </Text>
              ))}
            </View>
          ) : null}
          {tpl.rampUp ? (
            <Text
              style={{
                marginTop: 8,
                fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                fontSize: 13,
                lineHeight: 18,
                color: ed.colors.brand,
              }}
            >
              {tpl.rampUp}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {tpl.items.map((it, i) => {
              const p = findPeptide(it.peptide_id);
              return (
                <View
                  key={`${it.peptide_id}-${i}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderWidth: 1,
                    borderColor: ed.colors.lineStrong,
                  }}
                >
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: p?.color ?? ed.colors.brand,
                    }}
                  />
                  <Text
                    style={{
                      fontFamily: ed.typography.labelSm.fontFamily,
                      fontSize: ed.typography.labelSm.fontSize,
                      letterSpacing: ed.typography.labelSm.letterSpacing,
                      color: ed.colors.ink2,
                      textTransform: 'uppercase',
                    }}
                  >
                    {p?.name ?? it.peptide_id}
                  </Text>
                </View>
              );
            })}
          </View>
          {(() => {
            const phased = tpl.items
              .map((it) => ({
                peptide: findPeptide(it.peptide_id),
                phases: getPeptideExtras(it.peptide_id)?.cycleTemplate?.phases ?? [],
              }))
              .filter((x) => x.phases.length > 1);
            if (phased.length === 0) return null;
            return (
              <View style={{ marginTop: 10, gap: 4 }}>
                <Text
                  style={{
                    fontFamily: ed.typography.labelSm.fontFamily,
                    fontSize: ed.typography.labelSm.fontSize,
                    letterSpacing: ed.typography.labelSm.letterSpacing,
                    color: ed.colors.brand,
                    textTransform: 'uppercase',
                  }}
                >
                  Multi-phase
                </Text>
                {phased.map(({ peptide, phases }) => (
                  <Text
                    key={peptide?.id ?? 'x'}
                    style={{
                      fontFamily: ed.typography.dataMd.fontFamily,
                      fontSize: 12,
                      lineHeight: 16,
                      color: ed.colors.ink2,
                    }}
                  >
                    {peptide?.name ?? ''}:{' '}
                    {phases
                      .map(
                        (ph) =>
                          `${ph.name} ${ph.weeks}w${ph.dose_modifier ? ` (${ph.dose_modifier})` : ''}`
                      )
                      .join(' → ')}
                  </Text>
                ))}
              </View>
            );
          })()}
        </View>
      </View>
    </Pressable>
  );

  const Step2 = () => {
    const scratchSelected = selectionId === SCRATCH_ID;
    return (
      <View>
        <View style={{ marginTop: 14 }}>
          <EditorialHeadline size="title1">{`Pick a *template*.`}</EditorialHeadline>
          <Text
            style={{
              marginTop: 8,
              fontFamily: ed.typography.bodySm.fontFamily,
              fontSize: ed.typography.bodySm.fontSize,
              lineHeight: ed.typography.bodySm.lineHeight,
              color: ed.colors.ink3,
            }}
          >
            Or start blank and build your own.
          </Text>
        </View>
        {/* Template search */}
        <View
          style={{
            marginTop: 18,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: ed.colors.line,
            paddingVertical: 6,
          }}
        >
          <Text
            style={{
              fontFamily: ed.typography.label.fontFamily,
              fontSize: ed.typography.label.fontSize,
              letterSpacing: ed.typography.label.letterSpacing,
              color: ed.colors.ink3,
              textTransform: 'uppercase',
            }}
          >
            ⌕
          </Text>
          <TextInput
            placeholder="SEARCH BY NAME, BENEFIT, PEPTIDE"
            placeholderTextColor={ed.colors.ink3}
            value={templateQuery}
            onChangeText={setTemplateQuery}
            returnKeyType="search"
            selectionColor={ed.colors.brand}
            autoCapitalize="characters"
            style={{
              flex: 1,
              fontFamily: ed.typography.dataMd.fontFamily,
              fontSize: ed.typography.dataMd.fontSize,
              letterSpacing: 0.4,
              color: ed.colors.ink1,
              paddingVertical: 10,
            }}
          />
          {templateQuery.length > 0 ? (
            <Pressable onPress={() => setTemplateQuery('')} hitSlop={10}>
              <Text
                style={{
                  fontFamily: ed.fraunces('Fraunces_300Light'),
                  fontSize: 22,
                  color: ed.colors.ink3,
                }}
              >
                ×
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View style={{ marginTop: 12 }}>
          {filteredTemplates.length === 0 ? (
            <Text
              style={{
                paddingVertical: 24,
                fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                fontSize: 16,
                color: ed.colors.ink3,
                textAlign: 'center',
              }}
            >
              No pre-built templates for {goal}. Start from scratch below.
            </Text>
          ) : (
            filteredTemplates.map((tpl, idx) => (
              <View key={tpl.id}>
                <TemplateRow tpl={tpl} selected={selectionId === tpl.id} />
                <HairlineRow />
              </View>
            ))
          )}
          <Pressable
            onPress={() => setSelectionId(SCRATCH_ID)}
            accessibilityRole="radio"
            accessibilityState={{ selected: scratchSelected }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 18,
              gap: 14,
            }}
          >
            <RadioDot active={scratchSelected} ed={ed} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                  fontSize: 19,
                  letterSpacing: -0.3,
                  color: scratchSelected ? ed.colors.ink1 : ed.colors.ink2,
                }}
              >
                Start from scratch
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontFamily: ed.typography.labelSm.fontFamily,
                  fontSize: ed.typography.labelSm.fontSize,
                  letterSpacing: ed.typography.labelSm.letterSpacing,
                  color: ed.colors.ink3,
                  textTransform: 'uppercase',
                }}
              >
                Build your own protocol
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    );
  };

  const ItemEditor = ({ it, idx }: { it: CycleProtocolItem; idx: number }) => {
    const p = findPeptide(it.peptide_id);
    const extras = getPeptideExtras(it.peptide_id);
    const itemIds = new Set(items.map((x) => x.peptide_id));
    const pairs = (extras?.coAdministration ?? []).filter(
      (c) => c.co_reconstitute === true && !itemIds.has(c.peptide_id)
    );
    const stepBy = doseStepFor(it.dose_mcg);
    const inputMode = inputModeFor(it.peptide_id, it.dose_mcg);
    const displayValue =
      doseText[it.peptide_id] ?? formatDoseForInput(it.dose_mcg, inputMode);
    return (
      <View
        style={{
          paddingVertical: 18,
          borderTopWidth: 1,
          borderTopColor: ed.colors.line,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: p?.color ?? ed.colors.brand,
            }}
          />
          <Text
            style={{
              flex: 1,
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 19,
              letterSpacing: -0.3,
              color: ed.colors.ink1,
            }}
          >
            {p?.name ?? it.peptide_id}
          </Text>
          <Pressable onPress={() => removeItem(idx)} hitSlop={8}>
            <Text
              style={{
                fontFamily: ed.typography.label.fontFamily,
                fontSize: ed.typography.label.fontSize,
                letterSpacing: ed.typography.label.letterSpacing,
                color: ed.colors.stateWarn,
                textTransform: 'uppercase',
              }}
            >
              Remove
            </Text>
          </Pressable>
        </View>

        <View
          style={{
            marginTop: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text
            style={{
              fontFamily: ed.typography.labelSm.fontFamily,
              fontSize: ed.typography.labelSm.fontSize,
              letterSpacing: ed.typography.labelSm.letterSpacing,
              color: ed.colors.ink3,
              textTransform: 'uppercase',
            }}
          >
            Dose
          </Text>
          <DoseInputUnitChip
            mode={inputMode}
            onChange={(next) => setDoseInputModeFor(idx, it.peptide_id, next)}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <Pressable
            onPress={() => stepDoseBy(idx, it.peptide_id, it.dose_mcg, -stepBy)}
            hitSlop={8}
          >
            <Text
              style={{
                fontFamily: ed.typography.dataLg.fontFamily,
                fontSize: 22,
                color: ed.colors.ink3,
                paddingHorizontal: 14,
              }}
            >
              −
            </Text>
          </Pressable>
          <TextInput
            value={displayValue}
            onChangeText={(v) => setDoseFromInput(idx, it.peptide_id, v)}
            keyboardType="decimal-pad"
            selectionColor={ed.colors.brand}
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 26,
              letterSpacing: -0.5,
              color: ed.colors.ink1,
              paddingVertical: 6,
              borderBottomWidth: 1,
              borderBottomColor: ed.colors.line,
            }}
          />
          <Pressable
            onPress={() => stepDoseBy(idx, it.peptide_id, it.dose_mcg, stepBy)}
            hitSlop={8}
          >
            <Text
              style={{
                fontFamily: ed.typography.dataLg.fontFamily,
                fontSize: 22,
                color: ed.colors.ink3,
                paddingHorizontal: 14,
              }}
            >
              +
            </Text>
          </Pressable>
        </View>

        <Text
          style={{
            marginTop: 18,
            fontFamily: ed.typography.labelSm.fontFamily,
            fontSize: ed.typography.labelSm.fontSize,
            letterSpacing: ed.typography.labelSm.letterSpacing,
            color: ed.colors.ink3,
            textTransform: 'uppercase',
          }}
        >
          Frequency
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {FREQ_OPTIONS.map((f) => (
            <Chip
              key={f}
              active={it.freq === f}
              label={f}
              onPress={() => updateItem(idx, { freq: f })}
              ed={ed}
              disabled={(it.phases?.length ?? 0) >= 2}
            />
          ))}
        </View>
        {(it.phases?.length ?? 0) >= 2 ? (
          <Text
            style={{
              marginTop: 6,
              fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
              fontSize: 12,
              lineHeight: 16,
              color: ed.colors.ink3,
            }}
          >
            Frequency is set per phase below.
          </Text>
        ) : null}

        {(() => {
          const phases = it.phases ?? [];
          const trimmed = phases.map((p) => (p.name ?? '').trim());
          const nameCounts = trimmed.reduce<Record<string, number>>((acc, n) => {
            acc[n] = (acc[n] ?? 0) + 1;
            return acc;
          }, {});
          const renderPhaseRow = (ph: CycleProtocolItemPhase, pi: number) => {
            const tName = trimmed[pi];
            const errors: string[] = [];
            if (tName.length === 0) errors.push('Name is required.');
            else if (tName.length > 32) errors.push('Name must be 32 characters or fewer.');
            else if (nameCounts[tName] > 1) errors.push('Phase names must be unique within a peptide.');
            if (ph.startWeek > durationWeeks) {
              errors.push("This phase starts after your cycle ends — it won't activate.");
            }
            return (
              <View
                key={pi}
                style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: ed.colors.line,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Pressable
                    onPress={() =>
                      updatePhase(idx, pi, { startWeek: Math.max(1, ph.startWeek - 1) })
                    }
                    hitSlop={8}
                  >
                    <Text style={{ fontFamily: ed.typography.dataLg.fontFamily, fontSize: 18, color: ed.colors.ink3, paddingHorizontal: 8 }}>−</Text>
                  </Pressable>
                  <Text
                    style={{
                      fontFamily: ed.typography.dataMd.fontFamily,
                      fontSize: ed.typography.dataMd.fontSize,
                      letterSpacing: ed.typography.dataMd.letterSpacing,
                      color: ed.colors.ink2,
                      minWidth: 56,
                    }}
                  >
                    WK {ph.startWeek}
                  </Text>
                  <Pressable
                    onPress={() => updatePhase(idx, pi, { startWeek: ph.startWeek + 1 })}
                    hitSlop={8}
                  >
                    <Text style={{ fontFamily: ed.typography.dataLg.fontFamily, fontSize: 18, color: ed.colors.ink3, paddingHorizontal: 8 }}>+</Text>
                  </Pressable>
                  <TextInput
                    value={ph.name ?? ''}
                    onChangeText={(v) => updatePhase(idx, pi, { name: v })}
                    placeholder="Phase name"
                    placeholderTextColor={ed.colors.ink4}
                    selectionColor={ed.colors.brand}
                    maxLength={48}
                    style={{
                      flex: 1,
                      fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                      fontSize: 16,
                      color: ed.colors.ink1,
                      paddingVertical: 4,
                      borderBottomWidth: 1,
                      borderBottomColor: ed.colors.line,
                    }}
                  />
                  <Pressable onPress={() => removePhase(idx, pi)} hitSlop={8}>
                    <Text
                      style={{
                        fontFamily: ed.typography.dataLg.fontFamily,
                        fontSize: 22,
                        color: ed.colors.ink3,
                        paddingHorizontal: 6,
                      }}
                    >
                      ×
                    </Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {FREQ_OPTIONS.map((f) => (
                    <Chip
                      key={f}
                      active={ph.freq === f}
                      label={f}
                      onPress={() => updatePhase(idx, pi, { freq: f })}
                      ed={ed}
                    />
                  ))}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <Pressable
                    onPress={() => {
                      const cur = ph.dose_mcg ?? it.dose_mcg;
                      updatePhase(idx, pi, { dose_mcg: Math.max(0, cur - doseStepFor(cur)) });
                    }}
                    hitSlop={8}
                  >
                    <Text style={{ fontFamily: ed.typography.dataLg.fontFamily, fontSize: 18, color: ed.colors.ink3, paddingHorizontal: 12 }}>−</Text>
                  </Pressable>
                  <Text
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontFamily: ed.fraunces('Fraunces_400Regular'),
                      fontSize: 18,
                      color: ed.colors.ink1,
                    }}
                  >
                    {(() => {
                      const cur = ph.dose_mcg ?? it.dose_mcg;
                      const f = formatDose(cur, inputMode);
                      return `${f.value} ${f.unit}`;
                    })()}
                  </Text>
                  <Pressable
                    onPress={() => {
                      const cur = ph.dose_mcg ?? it.dose_mcg;
                      updatePhase(idx, pi, { dose_mcg: cur + doseStepFor(cur) });
                    }}
                    hitSlop={8}
                  >
                    <Text style={{ fontFamily: ed.typography.dataLg.fontFamily, fontSize: 18, color: ed.colors.ink3, paddingHorizontal: 12 }}>+</Text>
                  </Pressable>
                </View>
                {errors.length > 0 ? (
                  <Text
                    style={{
                      marginTop: 6,
                      fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                      fontSize: 12,
                      lineHeight: 16,
                      color: ed.colors.stateWarn,
                    }}
                  >
                    {errors.join(' ')}
                  </Text>
                ) : null}
              </View>
            );
          };
          // Auto-sort by startWeek for display so users always see
          // chronological order regardless of insertion order. Internal
          // state still keeps insertion order; the render-time sort just
          // pairs each phase with its original index for editing.
          const indexedSorted = phases
            .map((ph, pi) => ({ ph, pi }))
            .sort((a, b) => a.ph.startWeek - b.ph.startWeek);
          return (
            <View style={{ marginTop: 18 }}>
              <Text
                style={{
                  fontFamily: ed.typography.labelSm.fontFamily,
                  fontSize: ed.typography.labelSm.fontSize,
                  letterSpacing: ed.typography.labelSm.letterSpacing,
                  color: ed.colors.ink3,
                  textTransform: 'uppercase',
                }}
              >
                {phases.length === 0 ? 'Phases · none' : `Phases · ${phases.length}`}
              </Text>
              {indexedSorted.map(({ ph, pi }) => renderPhaseRow(ph, pi))}
              <Pressable
                onPress={() => addPhase(idx)}
                style={{
                  marginTop: 10,
                  paddingVertical: 10,
                  borderTopWidth: 1,
                  borderTopColor: ed.colors.line,
                }}
              >
                <Text
                  style={{
                    fontFamily: ed.typography.labelSm.fontFamily,
                    fontSize: ed.typography.labelSm.fontSize,
                    letterSpacing: ed.typography.labelSm.letterSpacing,
                    color: ed.colors.brand,
                    textTransform: 'uppercase',
                  }}
                >
                  + Add phase
                </Text>
              </Pressable>
            </View>
          );
        })()}

        <Text
          style={{
            marginTop: 18,
            fontFamily: ed.typography.labelSm.fontFamily,
            fontSize: ed.typography.labelSm.fontSize,
            letterSpacing: ed.typography.labelSm.letterSpacing,
            color: ed.colors.ink3,
            textTransform: 'uppercase',
          }}
        >
          Time of day
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {TIME_OPTIONS.map((to) => (
            <Chip
              key={to}
              active={it.time_of_day === to}
              label={to}
              tone="brand"
              onPress={() => updateItem(idx, { time_of_day: to })}
              ed={ed}
            />
          ))}
        </View>

        {extras?.timing ? (
          <Text
            style={{
              marginTop: 14,
              fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
              fontSize: 13,
              lineHeight: 19,
              color: ed.colors.ink3,
            }}
          >
            Suggested: {extras.timing}
          </Text>
        ) : null}

        {pairs.length > 0 ? (
          <View style={{ marginTop: 18 }}>
            <Text
              style={{
                fontFamily: ed.typography.labelSm.fontFamily,
                fontSize: ed.typography.labelSm.fontSize,
                letterSpacing: ed.typography.labelSm.letterSpacing,
                color: ed.colors.brand,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Pairs with
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {pairs.map((c) => {
                const partner = findPeptide(c.peptide_id);
                return (
                  <Pressable
                    key={c.peptide_id}
                    onPress={() => addPeptide(c.peptide_id)}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderWidth: 1,
                      borderColor: ed.colors.brandLine,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: ed.typography.labelSm.fontFamily,
                        fontSize: ed.typography.labelSm.fontSize,
                        letterSpacing: ed.typography.labelSm.letterSpacing,
                        color: ed.colors.brand,
                        textTransform: 'uppercase',
                      }}
                    >
                      + {partner?.name ?? c.peptide_id}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const PeptidePicker = () => (
    <View
      style={{
        marginVertical: 14,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: ed.colors.line,
      }}
    >
      <View
        style={{
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: ed.colors.line,
        }}
      >
        <TextInput
          value={pickerQuery}
          onChangeText={setPickerQuery}
          placeholder="SEARCH PEPTIDES"
          placeholderTextColor={ed.colors.ink3}
          autoCapitalize="characters"
          autoCorrect={false}
          selectionColor={ed.colors.brand}
          style={{
            fontFamily: ed.typography.dataMd.fontFamily,
            fontSize: ed.typography.dataMd.fontSize,
            letterSpacing: 0.4,
            color: ed.colors.ink1,
            padding: 0,
          }}
        />
      </View>
      <ScrollView nestedScrollEnabled style={{ height: 280 }}>
        {filteredPickerPeptides.length === 0 ? (
          <Text
            style={{
              paddingVertical: 28,
              textAlign: 'center',
              fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
              fontSize: 15,
              color: ed.colors.ink3,
            }}
          >
            {`No peptides match "${pickerQuery}"`}
          </Text>
        ) : (
          filteredPickerPeptides.map((p, idx) => {
            const already = items.some((i) => i.peptide_id === p.id);
            return (
              <View key={p.id}>
                <Pressable
                  onPress={() => {
                    if (!already) addPeptide(p.id);
                  }}
                  disabled={already}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 14,
                    opacity: already ? 0.45 : 1,
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: p.color,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: ed.fraunces('Fraunces_400Regular'),
                        fontSize: 16,
                        color: ed.colors.ink1,
                      }}
                    >
                      {p.name}
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontFamily: ed.typography.bodySm.fontFamily,
                        fontSize: ed.typography.bodySm.fontSize,
                        color: ed.colors.ink3,
                      }}
                      numberOfLines={1}
                    >
                      {p.subtitle}
                    </Text>
                  </View>
                  {already ? (
                    <Text
                      style={{
                        fontFamily: ed.typography.labelSm.fontFamily,
                        fontSize: ed.typography.labelSm.fontSize,
                        letterSpacing: ed.typography.labelSm.letterSpacing,
                        color: ed.colors.brand,
                        textTransform: 'uppercase',
                      }}
                    >
                      ✓ Added
                    </Text>
                  ) : null}
                </Pressable>
                {idx < filteredPickerPeptides.length - 1 ? <HairlineRow /> : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );

  const Step3 = () => (
    <View>
      <View style={{ marginTop: 14 }}>
        <EditorialHeadline size="title1">{`*Customize* your protocol.`}</EditorialHeadline>
      </View>

      <View style={{ marginTop: 28 }}>
        <EyebrowLabel withRule>Cycle name</EyebrowLabel>
        <TextInput
          value={cycleName}
          onChangeText={setCycleName}
          placeholder="My cycle"
          placeholderTextColor={ed.colors.ink4}
          maxLength={80}
          returnKeyType="done"
          selectionColor={ed.colors.brand}
          style={{
            marginTop: 14,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: ed.colors.line,
            fontFamily: ed.fraunces('Fraunces_400Regular'),
            fontSize: 22,
            letterSpacing: -0.4,
            color: ed.colors.ink1,
          }}
        />
      </View>

      <View style={{ marginTop: 24 }}>
        <EyebrowLabel withRule>Starts on</EyebrowLabel>
        <Stepper
          ed={ed}
          minusDisabled={startOffset === MIN_START_OFFSET}
          plusDisabled={startOffset === MAX_START_OFFSET}
          onMinus={() => setStartOffset((d) => Math.max(MIN_START_OFFSET, d - 1))}
          onPlus={() => setStartOffset((d) => Math.min(MAX_START_OFFSET, d + 1))}
          display={
            startOffset === 0
              ? `Today · ${formatDate(startDate)}`
              : startOffset === 1
              ? `Tomorrow · ${formatDate(startDate)}`
              : startOffset === -1
              ? `Yesterday · ${formatDate(startDate)}`
              : `${formatDate(startDate)} · ${startOffset > 0 ? '+' : ''}${startOffset}d`
          }
        />
      </View>

      <View style={{ marginTop: 24 }}>
        <EyebrowLabel withRule>{`Duration · ends ${formatDate(endDate)}`}</EyebrowLabel>
        <Stepper
          ed={ed}
          minusDisabled={durationWeeks === 1}
          plusDisabled={durationWeeks === 52}
          onMinus={() => setDurationWeeks((w) => Math.max(1, w - 1))}
          onPlus={() => setDurationWeeks((w) => Math.min(52, w + 1))}
          display={`${durationWeeks} ${durationWeeks === 1 ? 'week' : 'weeks'}`}
        />
      </View>

      <View style={{ marginTop: 24 }}>
        <EyebrowLabel withRule>Phase</EyebrowLabel>
        <View style={{ marginTop: 4 }}>
          {PHASE_OPTIONS.map((p, idx) => {
            const selected = p.id === phase;
            return (
              <View key={p.id}>
                <Pressable
                  onPress={() => setPhase(p.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    gap: 14,
                  }}
                >
                  <RadioDot active={selected} ed={ed} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: ed.fraunces('Fraunces_400Regular'),
                        fontSize: 17,
                        letterSpacing: -0.2,
                        color: selected ? ed.colors.ink1 : ed.colors.ink2,
                      }}
                    >
                      {p.label}
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontFamily: ed.typography.labelSm.fontFamily,
                        fontSize: ed.typography.labelSm.fontSize,
                        letterSpacing: ed.typography.labelSm.letterSpacing,
                        color: ed.colors.ink3,
                        textTransform: 'uppercase',
                      }}
                    >
                      {p.desc}
                    </Text>
                  </View>
                </Pressable>
                {idx < PHASE_OPTIONS.length - 1 ? <HairlineRow /> : null}
              </View>
            );
          })}
        </View>
      </View>

      <View style={{ marginTop: 32, flexDirection: 'row', justifyContent: 'space-between' }}>
        <EyebrowLabel withRule>{`Protocol · ${items.length}`}</EyebrowLabel>
        <Pressable
          onPress={() => {
            setShowPicker((s) => !s);
            setPickerQuery('');
          }}
          hitSlop={6}
        >
          <Text
            style={{
              marginLeft: 12,
              fontFamily: ed.typography.label.fontFamily,
              fontSize: ed.typography.label.fontSize,
              letterSpacing: ed.typography.label.letterSpacing,
              color: ed.colors.brand,
              textTransform: 'uppercase',
            }}
          >
            {showPicker ? 'Close' : '+ Add'}
          </Text>
        </Pressable>
      </View>

      {showPicker ? <PeptidePicker /> : null}

      {(() => {
        // Titration banner: visible once any item carries a >=3-phase
        // titration ramp (same freq, varying dose) AND the user hasn't
        // dismissed it. Auto-dismisses on first phase edit.
        const hasTitrationRamp = items.some((it) => {
          const phases = it.phases ?? [];
          if (phases.length < 3) return false;
          const freqs = new Set(phases.map((p) => p.freq));
          if (freqs.size !== 1) return false;
          const doses = new Set(phases.map((p) => p.dose_mcg ?? it.dose_mcg));
          return doses.size >= 2;
        });
        if (!hasTitrationRamp || isTitrationBannerDismissed) return null;
        return (
          <View
            style={{
              marginTop: 18,
              padding: 14,
              borderWidth: 1,
              borderColor: ed.colors.brandLine,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: ed.typography.labelSm.fontFamily,
                  fontSize: ed.typography.labelSm.fontSize,
                  letterSpacing: ed.typography.labelSm.letterSpacing,
                  color: ed.colors.brand,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                Titration pre-filled
              </Text>
              <Text
                style={{
                  fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                  fontSize: 14,
                  lineHeight: 20,
                  color: ed.colors.ink2,
                }}
              >
                Standard titration pre-filled — adjust each phase to match your protocol.
              </Text>
            </View>
            <Pressable onPress={dismissTitrationBanner} hitSlop={10}>
              <Text
                style={{
                  fontFamily: ed.typography.dataLg.fontFamily,
                  fontSize: 22,
                  color: ed.colors.ink3,
                  paddingHorizontal: 4,
                }}
              >
                ×
              </Text>
            </Pressable>
          </View>
        );
      })()}

      {items.length === 0 ? (
        <Text
          style={{
            marginTop: 18,
            fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
            fontSize: 16,
            color: ed.colors.ink3,
            textAlign: 'center',
          }}
        >
          No peptides yet. Tap "Add" to get started.
        </Text>
      ) : (
        items.map((it, idx) => <ItemEditor key={`${it.peptide_id}-${idx}`} it={it} idx={idx} />)
      )}

      <View style={{ marginTop: 24 }}>
        <DosingDisclaimer />
      </View>
    </View>
  );

  const Step4 = () => (
    <View>
      <View style={{ marginTop: 14 }}>
        <EditorialHeadline size="title1">{`Review and *save*.`}</EditorialHeadline>
      </View>

      {/* Cycle summary */}
      <View style={{ marginTop: 28 }}>
        <EyebrowLabel withRule>Cycle</EyebrowLabel>
        <Text
          style={{
            marginTop: 14,
            fontFamily: ed.fraunces('Fraunces_400Regular'),
            fontSize: 28,
            letterSpacing: -0.6,
            color: ed.colors.ink1,
          }}
        >
          {cycleName.trim() === '' ? 'Unnamed cycle' : cycleName}
        </Text>
        <Text
          style={{
            marginTop: 4,
            fontFamily: ed.typography.labelSm.fontFamily,
            fontSize: ed.typography.labelSm.fontSize,
            letterSpacing: ed.typography.labelSm.letterSpacing,
            color: ed.colors.brand,
            textTransform: 'uppercase',
          }}
        >
          {PHASE_OPTIONS.find((p) => p.id === phase)?.label ?? phase} · {durationWeeks}{' '}
          {durationWeeks === 1 ? 'week' : 'weeks'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 24, marginTop: 18 }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: ed.typography.labelSm.fontFamily,
                fontSize: ed.typography.labelSm.fontSize,
                letterSpacing: ed.typography.labelSm.letterSpacing,
                color: ed.colors.ink3,
                textTransform: 'uppercase',
              }}
            >
              Starts
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontFamily: ed.fraunces('Fraunces_400Regular'),
                fontSize: 19,
                letterSpacing: -0.3,
                color: ed.colors.ink1,
              }}
            >
              {formatDate(startDate)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: ed.typography.labelSm.fontFamily,
                fontSize: ed.typography.labelSm.fontSize,
                letterSpacing: ed.typography.labelSm.letterSpacing,
                color: ed.colors.ink3,
                textTransform: 'uppercase',
              }}
            >
              Ends
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontFamily: ed.fraunces('Fraunces_400Regular'),
                fontSize: 19,
                letterSpacing: -0.3,
                color: ed.colors.ink1,
              }}
            >
              {formatDate(endDate)}
            </Text>
          </View>
        </View>
      </View>

      {/* Protocol list */}
      <View style={{ marginTop: 28 }}>
        <EyebrowLabel withRule>{`Protocol · ${items.length}`}</EyebrowLabel>
        <View style={{ marginTop: 4 }}>
          {items.map((it, idx) => {
            const p = findPeptide(it.peptide_id);
            return (
              <View key={`${it.peptide_id}-${idx}`}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: p?.color ?? ed.colors.brand,
                    }}
                  />
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: ed.fraunces('Fraunces_400Regular'),
                      fontSize: 17,
                      letterSpacing: -0.2,
                      color: ed.colors.ink1,
                    }}
                  >
                    {p?.name ?? it.peptide_id}
                  </Text>
                  <Text
                    style={{
                      fontFamily: ed.typography.dataMd.fontFamily,
                      fontSize: ed.typography.dataMd.fontSize,
                      color: ed.colors.ink3,
                    }}
                  >
                    {formatDoseLabel(it.dose_mcg, doseUnitPref)} · {it.freq} · {it.time_of_day}
                  </Text>
                </View>
                {idx < items.length - 1 ? <HairlineRow /> : null}
              </View>
            );
          })}
        </View>
      </View>

      {/* Existing vials — tick the ones this cycle should claim. */}
      {matchingVials.length > 0 || peptidesWithoutVial.length > 0 ? (
        <View style={{ marginTop: 28 }}>
          <EyebrowLabel withRule>Existing vials</EyebrowLabel>
          <View style={{ marginTop: 4 }}>
            {matchingVials.map((v, idx) => {
              const p = findPeptide(v.peptide_id);
              const checked = vialsToAttach.has(v.id);
              const reconLabel = new Date(v.reconstituted_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });
              const stale =
                v.cycle_id && v.cycle_id !== ''
                  ? 'Currently attached to another cycle — checking will move it here'
                  : null;
              return (
                <View key={v.id}>
                  <Pressable
                    onPress={() => toggleAttach(v.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={`Attach ${p?.name ?? v.peptide_id} vial`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      paddingVertical: 14,
                      gap: 14,
                    }}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        marginTop: 2,
                        borderWidth: 1,
                        borderColor: checked ? ed.colors.brand : ed.colors.lineStrong,
                        backgroundColor: checked ? ed.colors.brand : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {checked ? (
                        <Text
                          style={{
                            color: ed.colors.bg,
                            fontFamily: ed.typography.dataMd.fontFamily,
                            fontSize: 12,
                            lineHeight: 14,
                          }}
                        >
                          ✓
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: ed.fraunces('Fraunces_400Regular'),
                          fontSize: 17,
                          letterSpacing: -0.2,
                          color: ed.colors.ink1,
                        }}
                      >
                        {p?.name ?? v.peptide_id}
                      </Text>
                      <Text
                        style={{
                          marginTop: 2,
                          fontFamily: ed.typography.dataMd.fontFamily,
                          fontSize: ed.typography.dataMd.fontSize,
                          color: ed.colors.ink3,
                        }}
                      >
                        {v.remaining_mg.toFixed(2)} / {v.strength_mg} mg · reconstituted {reconLabel}
                        {v.is_active === 0 ? ' · depleted' : ''}
                      </Text>
                      {stale ? (
                        <Text
                          style={{
                            marginTop: 4,
                            fontFamily: ed.typography.labelSm.fontFamily,
                            fontSize: ed.typography.labelSm.fontSize,
                            letterSpacing: ed.typography.labelSm.letterSpacing,
                            color: ed.colors.stateModerate,
                            textTransform: 'uppercase',
                          }}
                        >
                          {stale}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                  {idx < matchingVials.length - 1 ? <HairlineRow /> : null}
                </View>
              );
            })}
          </View>
          {peptidesWithoutVial.length > 0 ? (
            <View
              style={{
                marginTop: matchingVials.length > 0 ? 14 : 4,
                paddingTop: matchingVials.length > 0 ? 14 : 0,
                borderTopWidth: matchingVials.length > 0 ? 1 : 0,
                borderTopColor: ed.colors.line,
                gap: 6,
              }}
            >
              <Text
                style={{
                  fontFamily: ed.typography.labelSm.fontFamily,
                  fontSize: ed.typography.labelSm.fontSize,
                  letterSpacing: ed.typography.labelSm.letterSpacing,
                  color: ed.colors.stateWarn,
                  textTransform: 'uppercase',
                }}
              >
                Needs reconstitution
              </Text>
              {peptidesWithoutVial.map((pid) => {
                const p = findPeptide(pid);
                return (
                  <Text
                    key={pid}
                    style={{
                      fontFamily: ed.typography.bodySm.fontFamily,
                      fontSize: 13,
                      lineHeight: 19,
                      color: ed.colors.ink2,
                    }}
                  >
                    ⚠ No vial yet for {p?.name ?? pid} — reconstitute after creating this cycle.
                  </Text>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Aggregated benefits / side effects / contraindications */}
      {(() => {
        const tpl = TEMPLATES.find((x) => x.id === selectionId);
        const benefits = new Set<string>();
        const sideEffects = new Set<string>();
        const contraindications = new Set<string>();
        if (tpl) {
          tpl.benefits.forEach((b) => benefits.add(b));
          tpl.sideEffects.forEach((s) => sideEffects.add(s));
        }
        for (const it of items) {
          const ex = getPeptideExtras(it.peptide_id);
          ex?.sideEffects?.forEach((s) => sideEffects.add(s));
          ex?.contraindications?.forEach((c) => contraindications.add(c));
        }
        const allBenefits = Array.from(benefits);
        const allSideEffects = Array.from(sideEffects);
        const allContra = Array.from(contraindications);
        if (allBenefits.length === 0 && allSideEffects.length === 0 && allContra.length === 0) {
          return null;
        }
        return (
          <>
            {allBenefits.length > 0 ? (
              <View style={{ marginTop: 28 }}>
                <Text
                  style={{
                    fontFamily: ed.typography.label.fontFamily,
                    fontSize: ed.typography.label.fontSize,
                    letterSpacing: ed.typography.label.letterSpacing,
                    color: ed.colors.brand,
                    textTransform: 'uppercase',
                    marginBottom: 12,
                  }}
                >
                  Cycle benefits
                </Text>
                <View
                  style={{
                    borderTopWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: ed.colors.brandLine,
                    paddingVertical: 14,
                    gap: 8,
                  }}
                >
                  {allBenefits.map((b) => (
                    <Text
                      key={b}
                      style={{
                        fontFamily: ed.typography.bodyMd.fontFamily,
                        fontSize: 14,
                        lineHeight: 21,
                        color: ed.colors.ink1,
                      }}
                    >
                      · {b}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}
            {allSideEffects.length > 0 ? (
              <View style={{ marginTop: 28 }}>
                <Text
                  style={{
                    fontFamily: ed.typography.label.fontFamily,
                    fontSize: ed.typography.label.fontSize,
                    letterSpacing: ed.typography.label.letterSpacing,
                    color: ed.colors.stateModerate,
                    textTransform: 'uppercase',
                    marginBottom: 12,
                  }}
                >
                  Side effects
                </Text>
                <View
                  style={{
                    borderTopWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: ed.colors.stateModerate,
                    paddingVertical: 14,
                    gap: 8,
                  }}
                >
                  {allSideEffects.map((s) => (
                    <Text
                      key={s}
                      style={{
                        fontFamily: ed.typography.bodyMd.fontFamily,
                        fontSize: 14,
                        lineHeight: 21,
                        color: ed.colors.ink1,
                      }}
                    >
                      · {s}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}
            {allContra.length > 0 ? (
              <View style={{ marginTop: 28 }}>
                <Text
                  style={{
                    fontFamily: ed.typography.label.fontFamily,
                    fontSize: ed.typography.label.fontSize,
                    letterSpacing: ed.typography.label.letterSpacing,
                    color: ed.colors.stateWarn,
                    textTransform: 'uppercase',
                    marginBottom: 12,
                  }}
                >
                  Contraindications
                </Text>
                <View
                  style={{
                    borderTopWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: ed.colors.stateWarn,
                    paddingVertical: 14,
                    gap: 8,
                  }}
                >
                  {allContra.map((c) => (
                    <Text
                      key={c}
                      style={{
                        fontFamily: ed.typography.bodyMd.fontFamily,
                        fontSize: 14,
                        lineHeight: 21,
                        color: ed.colors.ink1,
                      }}
                    >
                      · {c}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        );
      })()}

      {/* Timing breakdown */}
      {Object.keys(timingGroups).length > 0 ? (
        <View style={{ marginTop: 28 }}>
          <EyebrowLabel withRule>Timing</EyebrowLabel>
          <View style={{ marginTop: 4 }}>
            {Object.entries(timingGroups).map(([k, v], idx, arr) => (
              <View key={k}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: ed.fraunces('Fraunces_400Regular'),
                      fontSize: 17,
                      color: ed.colors.ink1,
                      textTransform: 'capitalize',
                    }}
                  >
                    {k}
                  </Text>
                  <Text
                    style={{
                      fontFamily: ed.typography.dataMd.fontFamily,
                      fontSize: ed.typography.dataMd.fontSize,
                      color: ed.colors.ink3,
                    }}
                  >
                    {v} {v === 1 ? 'dose' : 'doses'}
                  </Text>
                </View>
                {idx < arr.length - 1 ? <HairlineRow /> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Conflicts vs all-clear */}
      {conflicts.length > 0 ? (
        <View style={{ marginTop: 28 }}>
          <Text
            style={{
              fontFamily: ed.typography.label.fontFamily,
              fontSize: ed.typography.label.fontSize,
              letterSpacing: ed.typography.label.letterSpacing,
              color: ed.colors.stateWarn,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Stacking conflicts
          </Text>
          <View
            style={{
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: ed.colors.stateWarn,
              paddingVertical: 14,
              gap: 8,
            }}
          >
            {conflicts.map((c) => {
              const a = findPeptide(c.a);
              const b = findPeptide(c.b);
              return (
                <Text
                  key={`${c.a}-${c.b}`}
                  style={{
                    fontFamily: ed.typography.bodyMd.fontFamily,
                    fontSize: 14,
                    lineHeight: 21,
                    color: ed.colors.ink1,
                  }}
                >
                  <Text style={{ fontFamily: ed.fraunces('Fraunces_400Regular_Italic') }}>
                    {a?.name ?? c.a} + {b?.name ?? c.b}.
                  </Text>{' '}
                  {c.reason}
                </Text>
              );
            })}
          </View>
          <Pressable
            onPress={() => setAcceptConflicts((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptConflicts }}
            style={{
              marginTop: 16,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 14,
            }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                marginTop: 2,
                borderWidth: 1,
                borderColor: acceptConflicts ? ed.colors.brand : ed.colors.lineStrong,
                backgroundColor: acceptConflicts ? ed.colors.brand : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {acceptConflicts ? (
                <Text
                  style={{
                    color: ed.colors.bg,
                    fontFamily: ed.typography.dataMd.fontFamily,
                    fontSize: 12,
                    lineHeight: 14,
                  }}
                >
                  ✓
                </Text>
              ) : null}
            </View>
            <Text
              style={{
                flex: 1,
                fontFamily: ed.typography.bodyMd.fontFamily,
                fontSize: 14,
                lineHeight: 21,
                color: ed.colors.ink1,
              }}
            >
              I understand these conflicts and accept the risk.
            </Text>
          </Pressable>
        </View>
      ) : (
        <Text
          style={{
            marginTop: 24,
            fontFamily: ed.typography.labelSm.fontFamily,
            fontSize: ed.typography.labelSm.fontSize,
            letterSpacing: ed.typography.labelSm.letterSpacing,
            color: ed.colors.stateOptimal,
            textTransform: 'uppercase',
          }}
        >
          ✓ No stacking conflicts detected
        </Text>
      )}

      <View style={{ marginTop: 24 }}>
        <DosingDisclaimer />
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: ed.colors.bg }}>
      {/* Top bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: 24,
          borderBottomWidth: 1,
          borderBottomColor: ed.colors.line,
        }}
      >
        <Pressable
          onPress={handleBack}
          hitSlop={10}
          disabled={saving}
          style={{ opacity: saving ? 0.4 : 1 }}
        >
          <Text
            style={{
              fontFamily: ed.fraunces('Fraunces_300Light'),
              fontSize: 26,
              color: ed.colors.ink2,
              lineHeight: 26,
            }}
          >
            ←
          </Text>
        </Pressable>
        <Text
          style={{
            fontFamily: ed.typography.label.fontFamily,
            fontSize: ed.typography.label.fontSize,
            letterSpacing: ed.typography.label.letterSpacing,
            color: ed.colors.ink3,
            textTransform: 'uppercase',
          }}
        >
          New cycle
        </Text>
        <View style={{ width: 16 }}>
          {step === 4 ? (
            <Pressable onPress={handleSave} disabled={!canAdvance} hitSlop={8}>
              <Text
                style={{
                  fontFamily: ed.typography.label.fontFamily,
                  fontSize: ed.typography.label.fontSize,
                  letterSpacing: ed.typography.label.letterSpacing,
                  color: canAdvance ? ed.colors.brand : ed.colors.ink4,
                  textTransform: 'uppercase',
                }}
              >
                {saving ? 'Saving' : 'Save'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ProgressBar />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 40,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <StepCounter />
        {step === 1 ? <Step1 /> : null}
        {step === 2 ? <Step2 /> : null}
        {step === 3 ? <Step3 /> : null}
        {step === 4 ? <Step4 /> : null}
      </ScrollView>

      {/* Bottom action bar */}
      <View
        style={{
          flexDirection: 'row',
          gap: 12,
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          borderTopWidth: 1,
          borderTopColor: ed.colors.line,
          backgroundColor: ed.colors.bg,
        }}
      >
        {step > 1 ? (
          <View style={{ flex: 1 }}>
            <EditorialButton variant="secondary" fullWidth disabled={saving} onPress={handleBack}>
              Back
            </EditorialButton>
          </View>
        ) : null}
        <View style={{ flex: 2 }}>
          {step === 4 ? (
            <EditorialButton fullWidth disabled={!canAdvance} onPress={handleSave}>
              {saving ? 'Saving…' : 'Save cycle'}
            </EditorialButton>
          ) : (
            <EditorialButton fullWidth disabled={!canAdvance} onPress={handleNext}>
              Next
            </EditorialButton>
          )}
        </View>
      </View>
    </View>
  );
}

// ──────────────────────────────────────────── small inline helpers

function RadioDot({ active, ed }: { active: boolean; ed: EditorialTheme }) {
  return (
    <View
      style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: active ? ed.colors.brand : ed.colors.lineStrong,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {active ? (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: ed.colors.brand,
          }}
        />
      ) : null}
    </View>
  );
}

function Chip({
  active,
  label,
  tone = 'ink',
  onPress,
  ed,
  disabled = false,
}: {
  active: boolean;
  label: string;
  tone?: 'ink' | 'brand';
  onPress: () => void;
  ed: EditorialTheme;
  disabled?: boolean;
}) {
  const fill = tone === 'brand' ? ed.colors.brand : ed.colors.ink1;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: active ? fill : 'transparent',
        borderWidth: 1,
        borderColor: active ? fill : ed.colors.lineStrong,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text
        style={{
          fontFamily: ed.typography.labelSm.fontFamily,
          fontSize: ed.typography.labelSm.fontSize,
          letterSpacing: ed.typography.labelSm.letterSpacing,
          color: active ? ed.colors.bg : ed.colors.ink2,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Stepper({
  ed,
  display,
  onMinus,
  onPlus,
  minusDisabled,
  plusDisabled,
}: {
  ed: EditorialTheme;
  display: string;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled?: boolean;
  plusDisabled?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
      }}
    >
      <Pressable onPress={onMinus} hitSlop={8} disabled={minusDisabled}>
        <Text
          style={{
            fontFamily: ed.typography.dataLg.fontFamily,
            fontSize: 22,
            color: minusDisabled ? ed.colors.ink4 : ed.colors.ink3,
            paddingHorizontal: 14,
          }}
        >
          −
        </Text>
      </Pressable>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text
          style={{
            fontFamily: ed.fraunces('Fraunces_400Regular'),
            fontSize: 19,
            letterSpacing: -0.3,
            color: ed.colors.ink1,
          }}
        >
          {display}
        </Text>
      </View>
      <Pressable onPress={onPlus} hitSlop={8} disabled={plusDisabled}>
        <Text
          style={{
            fontFamily: ed.typography.dataLg.fontFamily,
            fontSize: 22,
            color: plusDisabled ? ed.colors.ink4 : ed.colors.ink3,
            paddingHorizontal: 14,
          }}
        >
          +
        </Text>
      </Pressable>
    </View>
  );
}
