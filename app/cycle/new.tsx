import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';
import {
  IconChevronLeft,
  IconClose,
  IconPlus,
} from '../../components/Icons';
import { DosingDisclaimer } from '../../components/Primitives';
import { PEPTIDES, findPeptide } from '../../lib/peptides';
import { getPeptideExtras } from '../../lib/peptide-extras';
import { createCycle, listCycles, type CycleProtocolItem } from '../../lib/db';

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
];

const TIME_OPTIONS: string[] = [
  'morning',
  'evening',
  'pre-workout',
  'pre-bed',
];

const PHASE_OPTIONS: { id: Phase; label: string; desc: string; explainer: string }[] = [
  {
    id: 'loading',
    label: 'Loading',
    desc: 'Ramp up',
    explainer:
      'Doses ramp up over the first 1–2 weeks so side-effects stay tolerable. Use loading on first cycles or whenever a peptide titrates (semaglutide, tirzepatide, MT-2, NAD+).',
  },
  {
    id: 'active',
    label: 'Active',
    desc: 'Full research dose',
    explainer:
      'Steady-state main protocol. Most healing, growth, and longevity stacks live here for the bulk of the cycle.',
  },
  {
    id: 'taper',
    label: 'Taper',
    desc: 'Scale down',
    explainer:
      'Step doses down at the end of a cycle to soften receptor rebound. Most useful for GHRPs / GHRH stacks and GLP-1s being discontinued.',
  },
  {
    id: 'washout',
    label: 'Washout',
    desc: 'Rest, no peptide',
    explainer:
      'A no-peptide stretch between cycles. Lets receptors re-sensitize so the next cycle works as intended. 2–4 weeks is typical for GHRPs; longer for TB-500.',
  },
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

// Parse a dose string into a default mcg value. Used only as a fallback when
// a Peptide doesn't expose `defaultDoseMcg`. The leading number is read in
// whatever unit appears anywhere in the string ("mg" anywhere → multiply by
// 1000) — covers strings like "0.25–2.4 mg weekly" that the older parser
// silently truncated to 0.25 mcg.
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
  const { t } = useTheme();
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

  const isCustom = goal === 'Custom';

  // Pre-fill from an existing cycle when the "Copy to new cycle" entry point
  // navigates here with copyFromCycleId. Runs once per id — jumps the flow to
  // step 3 (Customize) with the copied protocol already loaded.
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

  const [templateQuery, setTemplateQuery] = useState<string>('');

  const filteredTemplates = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    const inGoal = TEMPLATES.filter((tpl) => tpl.goal === goal);
    const matched = q
      ? inGoal.filter((tpl) =>
          [tpl.name, tpl.description, ...tpl.benefits, ...tpl.items.map((i) => findPeptide(i.peptide_id)?.name ?? '')]
            .join(' ')
            .toLowerCase()
            .includes(q),
        )
      : inGoal;
    // Stable sort: popular first, then original order.
    return matched.slice().sort((a, b) => {
      const ap = a.popular ? 0 : 1;
      const bp = b.popular ? 0 : 1;
      return ap - bp;
    });
  }, [goal, templateQuery]);

  const startDate = useMemo(
    () => addDays(new Date(), startOffset),
    [startOffset],
  );
  const endDate = useMemo(
    () => addDays(startDate, durationWeeks * 7),
    [startDate, durationWeeks],
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
    if (step === 3) return items.length > 0 && cycleName.trim().length > 0;
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
    setItems(tpl.items.map((i) => ({ ...i })));
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
        Alert.alert(
          'Discard cycle?',
          'Your selections will be lost.',
          [
            { text: 'Keep editing', style: 'cancel' },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => router.back(),
            },
          ],
        );
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

  const handleSave = async (): Promise<void> => {
    if (saving) return;
    if (conflicts.length > 0 && !acceptConflicts) return;
    setSaving(true);
    try {
      await createCycle({
        name: cycleName.trim(),
        starts_on: isoDate(startDate),
        ends_on: isoDate(endDate),
        phase,
        protocol: items,
      });
      router.replace('/(tabs)/stacks');
    } catch (e) {
      setSaving(false);
      const msg =
        e instanceof Error && e.message
          ? e.message
          : 'Something went wrong saving your cycle. Please try again.';
      Alert.alert('Could not save cycle', msg, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Retry',
          onPress: () => {
            void handleSave();
          },
        },
      ]);
    }
  };

  const addPeptide = (peptide_id: string): void => {
    if (items.some((i) => i.peptide_id === peptide_id)) return;
    const p = findPeptide(peptide_id);
    const extras = getPeptideExtras(peptide_id);
    // Prefer the explicit per-peptide default so we never have to guess.
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

  const updateItem = (
    idx: number,
    patch: Partial<CycleProtocolItem>,
  ): void => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );
  };

  const setDoseFromInput = (
    idx: number,
    peptide_id: string,
    raw: string,
  ): void => {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    setDoseText((prev) => ({ ...prev, [peptide_id]: cleaned }));
    const n = parseFloat(cleaned);
    updateItem(idx, { dose_mcg: isNaN(n) ? 0 : n });
  };

  const stepDoseBy = (
    idx: number,
    peptide_id: string,
    current: number,
    delta: number,
  ): void => {
    const newDose = Math.max(0, current + delta);
    updateItem(idx, { dose_mcg: newDose });
    setDoseText((prev) => ({ ...prev, [peptide_id]: String(newDose) }));
  };

  const renderProgressBar = (): React.ReactElement => (
    <View
      style={{
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: space.xl,
        paddingTop: space.sm,
      }}
    >
      {[1, 2, 3, 4].map((n) => {
        const active = n <= step;
        return (
          <View
            key={n}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: active ? t.accent : t.line,
            }}
          />
        );
      })}
    </View>
  );

  const renderStepCounter = (): React.ReactElement => (
    <Text
      style={{
        color: t.ink3,
        fontSize: 11,
        letterSpacing: 1.2,
        fontFamily: font.sansSemi,
        marginTop: space.lg,
      }}
    >
      STEP {step} OF 4
    </Text>
  );

  const renderHeading = (
    text: string,
    subtitle?: string,
  ): React.ReactElement => (
    <View style={{ marginTop: space.sm, marginBottom: space.xl }}>
      <Text
        style={{
          color: t.ink,
          fontSize: 28,
          fontFamily: font.sansBold,
          letterSpacing: -0.6,
        }}
      >
        {text}
      </Text>
      {subtitle !== undefined ? (
        <Text
          style={{
            color: t.ink2,
            fontSize: 15,
            fontFamily: font.sans,
            marginTop: space.xs,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  const renderSectionLabel = (text: string): React.ReactElement => (
    <Text
      style={{
        color: t.ink3,
        fontFamily: font.sansSemi,
        fontSize: 11,
        letterSpacing: 1,
        marginBottom: space.xs,
      }}
    >
      {text}
    </Text>
  );

  const renderStep1 = (): React.ReactElement => (
    <View>
      {renderHeading("What's your goal?", "We'll tailor templates to match")}
      <View style={{ gap: space.sm }}>
        {GOALS.map((g) => {
          const selected = g.id === goal;
          return (
            <Pressable
              key={g.id}
              onPress={() => handleGoalSelect(g.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${g.id}. ${g.subtitle}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: space.lg,
                borderRadius: radius.md,
                backgroundColor: selected ? t.accentSoft : t.surface,
                borderWidth: 1,
                borderColor: selected ? t.accent : t.line,
                gap: space.md,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: selected ? t.accent : t.ink4,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {selected ? (
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: t.accent,
                    }}
                  />
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: t.ink,
                    fontFamily: font.sansSemi,
                    fontSize: 16,
                  }}
                >
                  {g.id}
                </Text>
                <Text
                  style={{
                    color: t.ink3,
                    fontFamily: font.sans,
                    fontSize: 13,
                    marginTop: 2,
                  }}
                >
                  {g.subtitle}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderTemplateCard = (tpl: Template): React.ReactElement => {
    const selected = selectionId === tpl.id;
    return (
      <Pressable
        key={tpl.id}
        onPress={() => setSelectionId(tpl.id)}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${tpl.name}. ${tpl.description}`}
        style={({ pressed }) => ({
          padding: space.lg,
          borderRadius: radius.lg,
          backgroundColor: selected ? t.accentSoft : t.surface,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? t.accent : t.line,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
          <Text
            style={{
              color: t.ink,
              fontFamily: font.sansBold,
              fontSize: 17,
              flex: 1,
            }}
          >
            {tpl.name}
          </Text>
          {tpl.popular ? (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: radius.pill,
                backgroundColor: t.accent,
              }}
            >
              <Text
                style={{
                  color: t.accentInk,
                  fontFamily: font.sansBold,
                  fontSize: 9,
                  letterSpacing: 0.6,
                }}
              >
                POPULAR
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          style={{
            color: t.ink2,
            fontFamily: font.sans,
            fontSize: 13,
            marginTop: space.xs,
          }}
        >
          {tpl.description}
        </Text>

        {/* Why this stack */}
        {tpl.benefits.length > 0 ? (
          <View style={{ marginTop: space.md }}>
            <Text
              style={{
                color: t.accent,
                fontFamily: font.sansSemi,
                fontSize: 10,
                letterSpacing: 1,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Why this stack
            </Text>
            {tpl.benefits.slice(0, 2).map((b) => (
              <Text
                key={b}
                style={{ color: t.ink2, fontSize: 12, lineHeight: 17 }}
              >
                · {b}
              </Text>
            ))}
          </View>
        ) : null}

        {/* Watch for */}
        {tpl.sideEffects.length > 0 ? (
          <View style={{ marginTop: space.sm }}>
            <Text
              style={{
                color: t.warn,
                fontFamily: font.sansSemi,
                fontSize: 10,
                letterSpacing: 1,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Watch for
            </Text>
            {tpl.sideEffects.slice(0, 2).map((s) => (
              <Text
                key={s}
                style={{ color: t.ink2, fontSize: 12, lineHeight: 17 }}
              >
                · {s}
              </Text>
            ))}
          </View>
        ) : null}

        {/* Ramp-up tip */}
        {tpl.rampUp ? (
          <Text
            style={{
              color: t.ink3,
              fontSize: 12,
              fontStyle: 'italic',
              marginTop: space.sm,
              lineHeight: 17,
            }}
          >
            Ramp-up: {tpl.rampUp}
          </Text>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: space.xs,
            marginTop: space.md,
          }}
        >
          {tpl.items.map((it, i) => {
            const p = findPeptide(it.peptide_id);
            return (
              <View
                key={`${it.peptide_id}-${i}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.xs,
                  paddingHorizontal: space.sm,
                  paddingVertical: 4,
                  borderRadius: radius.pill,
                  backgroundColor: selected ? t.surface : t.surfaceAlt,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: p?.color ?? t.accent,
                  }}
                />
                <Text
                  style={{
                    color: t.ink,
                    fontFamily: font.sansMed,
                    fontSize: 12,
                  }}
                >
                  {p?.name ?? it.peptide_id}
                </Text>
              </View>
            );
          })}
        </View>
        <Text
          style={{
            color: t.ink3,
            fontFamily: font.mono,
            fontSize: 11,
            marginTop: space.md,
            letterSpacing: 0.5,
          }}
        >
          {tpl.duration_weeks} weeks · {tpl.phase}
        </Text>

        {/* Surface any multi-phase protocols baked into this template's
            peptides (e.g. TB-500 loading + maintenance). */}
        {(() => {
          const phased = tpl.items
            .map((it) => ({
              peptide: findPeptide(it.peptide_id),
              phases: getPeptideExtras(it.peptide_id)?.cycleTemplate?.phases ?? [],
            }))
            .filter((x) => x.phases.length > 1);
          if (phased.length === 0) return null;
          return (
            <View style={{ marginTop: space.sm, gap: 4 }}>
              <Text
                style={{
                  fontSize: 10,
                  color: t.accent,
                  fontFamily: font.sansSemi,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                Multi-phase protocol
              </Text>
              {phased.map(({ peptide, phases }) => (
                <Text
                  key={peptide?.id ?? 'x'}
                  style={{
                    fontSize: 11,
                    color: t.ink2,
                    fontFamily: font.mono,
                    lineHeight: 15,
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
      </Pressable>
    );
  };

  const renderStep2 = (): React.ReactElement => {
    const scratchSelected = selectionId === SCRATCH_ID;
    return (
      <View>
        {renderHeading(
          'Pick a starting template',
          'Or start blank and build your own',
        )}
        <TextInput
          value={templateQuery}
          onChangeText={setTemplateQuery}
          placeholder="Search templates or peptides…"
          placeholderTextColor={t.ink3}
          style={{
            backgroundColor: t.surfaceAlt,
            borderRadius: radius.md,
            paddingHorizontal: space.md,
            paddingVertical: 10,
            color: t.ink,
            fontSize: 14,
            fontFamily: font.sans,
            marginBottom: space.md,
          }}
        />
        <View style={{ gap: space.md }}>
          {filteredTemplates.length === 0 ? (
            <View
              style={{
                padding: space.xl,
                borderRadius: radius.md,
                backgroundColor: t.surfaceAlt,
                borderWidth: 1,
                borderColor: t.line,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: t.ink3,
                  fontFamily: font.sans,
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                No pre-built templates for {goal}.{'\n'}
                Start from scratch below.
              </Text>
            </View>
          ) : (
            filteredTemplates.map(renderTemplateCard)
          )}
          <Pressable
            onPress={() => setSelectionId(SCRATCH_ID)}
            accessibilityRole="radio"
            accessibilityState={{ selected: scratchSelected }}
            style={{
              padding: space.lg,
              borderRadius: radius.lg,
              backgroundColor: scratchSelected ? t.accentSoft : t.surfaceAlt,
              borderWidth: scratchSelected ? 2 : 1,
              borderColor: scratchSelected ? t.accent : t.line,
              borderStyle: scratchSelected ? 'solid' : 'dashed',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: t.ink,
                fontFamily: font.sansSemi,
                fontSize: 15,
              }}
            >
              Start from scratch
            </Text>
            <Text
              style={{
                color: t.ink3,
                fontFamily: font.sans,
                fontSize: 13,
                marginTop: space.xs,
              }}
            >
              Build your own protocol
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderDoseStepper = (
    it: CycleProtocolItem,
    idx: number,
  ): React.ReactElement => {
    const stepBy = doseStepFor(it.dose_mcg);
    const displayValue = doseText[it.peptide_id] ?? String(it.dose_mcg);
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          marginTop: space.xs,
        }}
      >
        <Pressable
          onPress={() => stepDoseBy(idx, it.peptide_id, it.dose_mcg, -stepBy)}
          accessibilityLabel={`Decrease dose by ${stepBy}`}
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.md,
            backgroundColor: t.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: t.ink,
              fontSize: 20,
              fontFamily: font.sansBold,
            }}
          >
            −
          </Text>
        </Pressable>
        <TextInput
          value={displayValue}
          onChangeText={(v) => setDoseFromInput(idx, it.peptide_id, v)}
          keyboardType="decimal-pad"
          accessibilityLabel="Dose in micrograms"
          style={{
            flex: 1,
            height: 36,
            borderRadius: radius.md,
            backgroundColor: t.surfaceAlt,
            paddingHorizontal: space.md,
            color: t.ink,
            fontFamily: font.monoSemi,
            fontSize: 14,
            textAlign: 'center',
          }}
        />
        <Pressable
          onPress={() => stepDoseBy(idx, it.peptide_id, it.dose_mcg, stepBy)}
          accessibilityLabel={`Increase dose by ${stepBy}`}
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.md,
            backgroundColor: t.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: t.ink,
              fontSize: 20,
              fontFamily: font.sansBold,
            }}
          >
            +
          </Text>
        </Pressable>
      </View>
    );
  };

  const renderItemCard = (
    it: CycleProtocolItem,
    idx: number,
  ): React.ReactElement => {
    const p = findPeptide(it.peptide_id);
    const extras = getPeptideExtras(it.peptide_id);
    const itemIds = new Set(items.map((x) => x.peptide_id));
    const pairs = (extras?.coAdministration ?? []).filter(
      (c) => c.co_reconstitute === true && !itemIds.has(c.peptide_id),
    );
    return (
      <View
        key={`${it.peptide_id}-${idx}`}
        style={{
          padding: space.lg,
          borderRadius: radius.lg,
          backgroundColor: t.surface,
          borderWidth: 1,
          borderColor: t.line,
          marginBottom: space.md,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              flex: 1,
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: p?.color ?? t.accent,
              }}
            />
            <Text
              style={{
                color: t.ink,
                fontFamily: font.sansBold,
                fontSize: 15,
                flex: 1,
              }}
              numberOfLines={1}
            >
              {p?.name ?? it.peptide_id}
            </Text>
          </View>
          <Pressable
            onPress={() => removeItem(idx)}
            hitSlop={8}
            accessibilityLabel={`Remove ${p?.name ?? it.peptide_id}`}
            style={{ padding: 4 }}
          >
            <IconClose color={t.ink3} size={18} />
          </Pressable>
        </View>

        <Text
          style={{
            color: t.ink3,
            fontFamily: font.sansSemi,
            fontSize: 11,
            letterSpacing: 1,
            marginTop: space.md,
          }}
        >
          DOSE (MCG)
        </Text>
        {renderDoseStepper(it, idx)}

        <Text
          style={{
            color: t.ink3,
            fontFamily: font.sansSemi,
            fontSize: 11,
            letterSpacing: 1,
            marginTop: space.md,
          }}
        >
          FREQUENCY
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: space.xs,
            marginTop: space.xs,
          }}
        >
          {FREQ_OPTIONS.map((f) => {
            const selected = it.freq === f;
            return (
              <Pressable
                key={f}
                onPress={() => updateItem(idx, { freq: f })}
                style={{
                  paddingHorizontal: space.md,
                  paddingVertical: 6,
                  borderRadius: radius.pill,
                  backgroundColor: selected ? t.accent : t.surfaceAlt,
                }}
              >
                <Text
                  style={{
                    color: selected ? t.accentInk : t.ink,
                    fontFamily: font.sansMed,
                    fontSize: 12,
                  }}
                >
                  {f}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text
          style={{
            color: t.ink3,
            fontFamily: font.sansSemi,
            fontSize: 11,
            letterSpacing: 1,
            marginTop: space.md,
          }}
        >
          TIME OF DAY
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: space.xs,
            marginTop: space.xs,
          }}
        >
          {TIME_OPTIONS.map((to) => {
            const selected = it.time_of_day === to;
            return (
              <Pressable
                key={to}
                onPress={() => updateItem(idx, { time_of_day: to })}
                style={{
                  paddingHorizontal: space.md,
                  paddingVertical: 6,
                  borderRadius: radius.pill,
                  backgroundColor: selected ? t.accent : t.surfaceAlt,
                }}
              >
                <Text
                  style={{
                    color: selected ? t.accentInk : t.ink,
                    fontFamily: font.sansMed,
                    fontSize: 12,
                  }}
                >
                  {to}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {extras?.timing !== undefined && extras.timing !== '' ? (
          <Text
            style={{
              color: t.ink3,
              fontFamily: font.sans,
              fontSize: 12,
              marginTop: space.md,
              fontStyle: 'italic',
            }}
          >
            Suggested timing: {extras.timing}
          </Text>
        ) : null}

        {pairs.length > 0 ? (
          <View style={{ marginTop: space.md }}>
            <Text
              style={{
                color: t.ink3,
                fontFamily: font.sansSemi,
                fontSize: 11,
                letterSpacing: 1,
                marginBottom: space.xs,
              }}
            >
              PAIRS WITH
            </Text>
            <View
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}
            >
              {pairs.map((c) => {
                const partner = findPeptide(c.peptide_id);
                return (
                  <Pressable
                    key={c.peptide_id}
                    onPress={() => addPeptide(c.peptide_id)}
                    accessibilityLabel={`Add ${partner?.name ?? c.peptide_id}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingHorizontal: space.sm,
                      paddingVertical: 4,
                      borderRadius: radius.pill,
                      backgroundColor: t.accentSoft,
                      borderWidth: 1,
                      borderColor: t.accent,
                    }}
                  >
                    <IconPlus color={t.accent} size={10} />
                    <Text
                      style={{
                        color: t.accent,
                        fontFamily: font.sansSemi,
                        fontSize: 12,
                      }}
                    >
                      {partner?.name ?? c.peptide_id}
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

  const renderStartDatePicker = (): React.ReactElement => (
    <View>
      {renderSectionLabel('STARTS ON')}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          marginBottom: space.lg,
        }}
      >
        <Pressable
          onPress={() => setStartOffset((d) => Math.max(0, d - 1))}
          disabled={startOffset === 0}
          accessibilityLabel="Earlier day"
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.line,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: startOffset === 0 ? 0.4 : 1,
          }}
        >
          <Text
            style={{
              color: t.ink,
              fontSize: 20,
              fontFamily: font.sansBold,
            }}
          >
            −
          </Text>
        </Pressable>
        <View
          style={{
            flex: 1,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: t.ink,
              fontFamily: font.monoSemi,
              fontSize: 15,
            }}
          >
            {startOffset === 0
              ? `Today · ${formatDate(startDate)}`
              : startOffset === 1
              ? `Tomorrow · ${formatDate(startDate)}`
              : `${formatDate(startDate)} · +${startOffset}d`}
          </Text>
        </View>
        <Pressable
          onPress={() =>
            setStartOffset((d) => Math.min(MAX_START_OFFSET, d + 1))
          }
          disabled={startOffset === MAX_START_OFFSET}
          accessibilityLabel="Later day"
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.line,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: startOffset === MAX_START_OFFSET ? 0.4 : 1,
          }}
        >
          <Text
            style={{
              color: t.ink,
              fontSize: 20,
              fontFamily: font.sansBold,
            }}
          >
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderPicker = (): React.ReactElement => (
    <View
      style={{
        borderRadius: radius.md,
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.line,
        marginBottom: space.md,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          padding: space.sm,
          borderBottomWidth: 1,
          borderBottomColor: t.line,
        }}
      >
        <TextInput
          value={pickerQuery}
          onChangeText={setPickerQuery}
          placeholder="Search peptides…"
          placeholderTextColor={t.ink4}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            height: 36,
            borderRadius: radius.sm,
            backgroundColor: t.surfaceAlt,
            paddingHorizontal: space.md,
            color: t.ink,
            fontFamily: font.sans,
            fontSize: 14,
          }}
        />
      </View>
      <ScrollView nestedScrollEnabled style={{ height: 300 }}>
        {filteredPickerPeptides.length === 0 ? (
          <View
            style={{
              padding: space.xl,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: t.ink3,
                fontFamily: font.sans,
                fontSize: 13,
              }}
            >
              {`No peptides match "${pickerQuery}"`}
            </Text>
          </View>
        ) : (
          filteredPickerPeptides.map((p) => {
            const already = items.some((i) => i.peptide_id === p.id);
            return (
              <Pressable
                key={p.id}
                onPress={() => {
                  if (!already) addPeptide(p.id);
                }}
                disabled={already}
                accessibilityLabel={
                  already ? `${p.name} already added` : `Add ${p.name}`
                }
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.sm,
                  paddingHorizontal: space.md,
                  paddingVertical: space.md,
                  borderBottomWidth: 1,
                  borderBottomColor: t.line,
                  opacity: already ? 0.5 : 1,
                }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: p.color,
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: t.ink,
                      fontFamily: font.sansSemi,
                      fontSize: 14,
                    }}
                  >
                    {p.name}
                  </Text>
                  <Text
                    style={{
                      color: t.ink3,
                      fontFamily: font.sans,
                      fontSize: 12,
                    }}
                    numberOfLines={1}
                  >
                    {p.subtitle}
                  </Text>
                </View>
                {already ? (
                  <Text
                    style={{
                      color: t.accent,
                      fontFamily: font.sansSemi,
                      fontSize: 11,
                      letterSpacing: 0.5,
                    }}
                  >
                    ✓ ADDED
                  </Text>
                ) : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );

  const renderStep3 = (): React.ReactElement => (
    <View>
      {renderHeading('Customize your protocol')}

      {renderSectionLabel('CYCLE NAME')}
      <TextInput
        value={cycleName}
        onChangeText={setCycleName}
        placeholder="My cycle"
        placeholderTextColor={t.ink4}
        maxLength={80}
        returnKeyType="done"
        style={{
          height: 48,
          borderRadius: radius.md,
          backgroundColor: t.surface,
          borderWidth: 1,
          borderColor: t.line,
          paddingHorizontal: space.md,
          color: t.ink,
          fontFamily: font.sans,
          fontSize: 15,
          marginBottom: space.lg,
        }}
      />

      {renderStartDatePicker()}

      {renderSectionLabel('DURATION (WEEKS)')}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          marginBottom: space.lg,
        }}
      >
        <Pressable
          onPress={() => setDurationWeeks((w) => Math.max(1, w - 1))}
          disabled={durationWeeks === 1}
          accessibilityLabel="Decrease duration"
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.line,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: durationWeeks === 1 ? 0.4 : 1,
          }}
        >
          <Text
            style={{
              color: t.ink,
              fontSize: 20,
              fontFamily: font.sansBold,
            }}
          >
            −
          </Text>
        </Pressable>
        <View
          style={{
            flex: 1,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: t.ink,
              fontFamily: font.monoSemi,
              fontSize: 16,
            }}
          >
            {durationWeeks} {durationWeeks === 1 ? 'week' : 'weeks'}
          </Text>
        </View>
        <Pressable
          onPress={() => setDurationWeeks((w) => Math.min(52, w + 1))}
          disabled={durationWeeks === 52}
          accessibilityLabel="Increase duration"
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.line,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: durationWeeks === 52 ? 0.4 : 1,
          }}
        >
          <Text
            style={{
              color: t.ink,
              fontSize: 20,
              fontFamily: font.sansBold,
            }}
          >
            +
          </Text>
        </Pressable>
      </View>

      {renderSectionLabel('PHASE')}
      <View style={{ gap: space.xs, marginBottom: space.lg }}>
        {PHASE_OPTIONS.map((p) => {
          const selected = p.id === phase;
          return (
            <Pressable
              key={p.id}
              onPress={() => setPhase(p.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: space.md,
                borderRadius: radius.md,
                backgroundColor: selected ? t.accentSoft : t.surface,
                borderWidth: 1,
                borderColor: selected ? t.accent : t.line,
                gap: space.md,
              }}
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  borderWidth: 2,
                  borderColor: selected ? t.accent : t.ink4,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {selected ? (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: t.accent,
                    }}
                  />
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: t.ink,
                    fontFamily: font.sansSemi,
                    fontSize: 14,
                  }}
                >
                  {p.label}
                </Text>
                <Text
                  style={{
                    color: t.ink3,
                    fontFamily: font.sans,
                    fontSize: 12,
                  }}
                >
                  {p.desc}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Phase explainer + multi-phase timeline preview */}
      <View
        style={{
          marginTop: -space.sm,
          marginBottom: space.lg,
          padding: space.md,
          borderRadius: radius.md,
          backgroundColor: t.surfaceAlt,
          borderLeftWidth: 3,
          borderLeftColor: t.accent,
        }}
      >
        <Text style={{ color: t.ink2, fontSize: 12, lineHeight: 17 }}>
          {PHASE_OPTIONS.find((p) => p.id === phase)?.explainer}
        </Text>
        {(() => {
          // Multi-phase preview when any selected peptide has phases.
          const phased = items
            .map((it) => ({
              peptide: findPeptide(it.peptide_id),
              phases: getPeptideExtras(it.peptide_id)?.cycleTemplate?.phases ?? [],
            }))
            .filter((x) => x.phases.length > 1);
          if (phased.length === 0) return null;
          return (
            <View style={{ marginTop: space.sm, gap: 4 }}>
              <Text
                style={{
                  fontSize: 10,
                  color: t.accent,
                  fontFamily: font.sansSemi,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                Built-in protocol timeline
              </Text>
              {phased.map(({ peptide, phases }) => (
                <Text
                  key={peptide?.id ?? 'x'}
                  style={{
                    fontSize: 11,
                    color: t.ink2,
                    fontFamily: font.mono,
                    lineHeight: 15,
                  }}
                >
                  {peptide?.name ?? ''}:{' '}
                  {phases
                    .map(
                      (ph) =>
                        `${ph.name} ${ph.weeks}w${ph.dose_modifier ? ` (${ph.dose_modifier})` : ''}`,
                    )
                    .join(' → ')}
                </Text>
              ))}
            </View>
          );
        })()}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: space.md,
        }}
      >
        <Text
          style={{
            color: t.ink3,
            fontFamily: font.sansSemi,
            fontSize: 11,
            letterSpacing: 1,
          }}
        >
          PROTOCOL ({items.length})
        </Text>
        <Pressable
          onPress={() => {
            setShowPicker((s) => !s);
            setPickerQuery('');
          }}
          accessibilityLabel={showPicker ? 'Close picker' : 'Add peptide'}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: space.md,
            paddingVertical: 6,
            borderRadius: radius.pill,
            backgroundColor: showPicker ? t.surfaceAlt : t.accent,
          }}
        >
          {showPicker ? (
            <IconClose color={t.ink} size={14} />
          ) : (
            <IconPlus color={t.accentInk} size={14} />
          )}
          <Text
            style={{
              color: showPicker ? t.ink : t.accentInk,
              fontFamily: font.sansSemi,
              fontSize: 12,
            }}
          >
            {showPicker ? 'Close' : 'Add peptide'}
          </Text>
        </Pressable>
      </View>

      {showPicker ? renderPicker() : null}

      {items.length === 0 ? (
        <View
          style={{
            padding: space.xl,
            borderRadius: radius.md,
            backgroundColor: t.surfaceAlt,
            borderWidth: 1,
            borderColor: t.line,
            borderStyle: 'dashed',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: t.ink3,
              fontFamily: font.sans,
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            {'No peptides yet. Tap "Add peptide" above.'}
          </Text>
        </View>
      ) : (
        items.map((it, idx) => renderItemCard(it, idx))
      )}

      <View style={{ marginTop: space.lg }}>
        <DosingDisclaimer />
      </View>
    </View>
  );

  const renderReviewItem = (
    it: CycleProtocolItem,
    idx: number,
  ): React.ReactElement => {
    const p = findPeptide(it.peptide_id);
    return (
      <View
        key={`${it.peptide_id}-${idx}`}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: space.sm,
          paddingVertical: space.sm,
          borderBottomWidth: idx === items.length - 1 ? 0 : 1,
          borderBottomColor: t.line,
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            marginTop: 6,
            backgroundColor: p?.color ?? t.accent,
          }}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: t.ink,
              fontFamily: font.sansSemi,
              fontSize: 14,
            }}
          >
            {p?.name ?? it.peptide_id}
          </Text>
          <Text
            style={{
              color: t.ink3,
              fontFamily: font.mono,
              fontSize: 12,
              marginTop: 2,
              letterSpacing: 0.3,
            }}
          >
            {it.dose_mcg} mcg · {it.freq} · {it.time_of_day}
          </Text>
        </View>
      </View>
    );
  };

  const renderStep4 = (): React.ReactElement => (
    <View>
      {renderHeading('Review and save')}

      <View
        style={{
          padding: space.lg,
          borderRadius: radius.lg,
          backgroundColor: t.surface,
          borderWidth: 1,
          borderColor: t.line,
          marginBottom: space.md,
        }}
      >
        <Text
          style={{
            color: t.ink,
            fontFamily: font.sansBold,
            fontSize: 18,
            marginBottom: space.xs,
          }}
        >
          {cycleName.trim() === '' ? 'Unnamed cycle' : cycleName}
        </Text>
        <Text
          style={{
            color: t.ink2,
            fontFamily: font.sans,
            fontSize: 13,
            marginBottom: space.md,
          }}
        >
          {PHASE_OPTIONS.find((p) => p.id === phase)?.label ?? phase} ·{' '}
          {durationWeeks} {durationWeeks === 1 ? 'week' : 'weeks'}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            gap: space.md,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: t.ink3,
                fontFamily: font.sansSemi,
                fontSize: 10,
                letterSpacing: 1,
              }}
            >
              STARTS
            </Text>
            <Text
              style={{
                color: t.ink,
                fontFamily: font.monoSemi,
                fontSize: 13,
                marginTop: 2,
              }}
            >
              {formatDate(startDate)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: t.ink3,
                fontFamily: font.sansSemi,
                fontSize: 10,
                letterSpacing: 1,
              }}
            >
              ENDS
            </Text>
            <Text
              style={{
                color: t.ink,
                fontFamily: font.monoSemi,
                fontSize: 13,
                marginTop: 2,
              }}
            >
              {formatDate(endDate)}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={{
          padding: space.lg,
          borderRadius: radius.lg,
          backgroundColor: t.surface,
          borderWidth: 1,
          borderColor: t.line,
          marginBottom: space.md,
        }}
      >
        <Text
          style={{
            color: t.ink3,
            fontFamily: font.sansSemi,
            fontSize: 11,
            letterSpacing: 1,
            marginBottom: space.xs,
          }}
        >
          PROTOCOL ({items.length})
        </Text>
        {items.map((it, idx) => renderReviewItem(it, idx))}
      </View>

      {/* Aggregated cycle benefits + side-effects */}
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
          <View
            style={{
              padding: space.lg,
              borderRadius: radius.lg,
              backgroundColor: t.surface,
              borderWidth: 1,
              borderColor: t.line,
              marginBottom: space.md,
              gap: space.md,
            }}
          >
            {allBenefits.length > 0 ? (
              <View>
                <Text
                  style={{
                    color: t.accent,
                    fontFamily: font.sansSemi,
                    fontSize: 10,
                    letterSpacing: 1,
                    marginBottom: 6,
                  }}
                >
                  CYCLE BENEFITS
                </Text>
                {allBenefits.map((b) => (
                  <Text key={b} style={{ color: t.ink2, fontSize: 13, lineHeight: 19 }}>
                    · {b}
                  </Text>
                ))}
              </View>
            ) : null}
            {allSideEffects.length > 0 ? (
              <View>
                <Text
                  style={{
                    color: t.warn,
                    fontFamily: font.sansSemi,
                    fontSize: 10,
                    letterSpacing: 1,
                    marginBottom: 6,
                  }}
                >
                  SIDE EFFECTS
                </Text>
                {allSideEffects.map((s) => (
                  <Text key={s} style={{ color: t.ink2, fontSize: 13, lineHeight: 19 }}>
                    · {s}
                  </Text>
                ))}
              </View>
            ) : null}
            {allContra.length > 0 ? (
              <View>
                <Text
                  style={{
                    color: t.danger,
                    fontFamily: font.sansSemi,
                    fontSize: 10,
                    letterSpacing: 1,
                    marginBottom: 6,
                  }}
                >
                  CONTRAINDICATIONS
                </Text>
                {allContra.map((c) => (
                  <Text key={c} style={{ color: t.ink2, fontSize: 13, lineHeight: 19 }}>
                    · {c}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        );
      })()}

      {Object.keys(timingGroups).length > 0 ? (
        <View
          style={{
            padding: space.lg,
            borderRadius: radius.lg,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.line,
            marginBottom: space.md,
          }}
        >
          <Text
            style={{
              color: t.ink3,
              fontFamily: font.sansSemi,
              fontSize: 11,
              letterSpacing: 1,
              marginBottom: space.sm,
            }}
          >
            TIMING
          </Text>
          <View style={{ gap: space.xs }}>
            {Object.entries(timingGroups).map(([k, v]) => (
              <View
                key={k}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Text
                  style={{
                    color: t.ink,
                    fontFamily: font.sansMed,
                    fontSize: 14,
                  }}
                >
                  {k}
                </Text>
                <Text
                  style={{
                    color: t.ink2,
                    fontFamily: font.monoSemi,
                    fontSize: 14,
                  }}
                >
                  {v} {v === 1 ? 'dose' : 'doses'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {conflicts.length > 0 ? (
        <>
          <View
            style={{
              padding: space.lg,
              borderRadius: radius.lg,
              backgroundColor: t.dangerSoft,
              borderWidth: 1,
              borderColor: t.danger,
              marginBottom: space.md,
            }}
          >
            <Text
              style={{
                color: t.danger,
                fontFamily: font.sansBold,
                fontSize: 13,
                letterSpacing: 0.5,
                marginBottom: space.sm,
              }}
            >
              STACKING CONFLICTS DETECTED
            </Text>
            <View style={{ gap: space.xs }}>
              {conflicts.map((c) => {
                const a = findPeptide(c.a);
                const b = findPeptide(c.b);
                return (
                  <Text
                    key={`${c.a}-${c.b}`}
                    style={{
                      color: t.ink,
                      fontFamily: font.sans,
                      fontSize: 13,
                    }}
                  >
                    <Text style={{ fontFamily: font.sansBold }}>
                      {a?.name ?? c.a} + {b?.name ?? c.b}:
                    </Text>{' '}
                    {c.reason}
                  </Text>
                );
              })}
            </View>
          </View>
          <Pressable
            onPress={() => setAcceptConflicts((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptConflicts }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              marginBottom: space.md,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                borderWidth: 2,
                borderColor: acceptConflicts ? t.accent : t.ink4,
                backgroundColor: acceptConflicts ? t.accent : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {acceptConflicts ? (
                <Text
                  style={{
                    color: t.accentInk,
                    fontSize: 14,
                    fontFamily: font.sansBold,
                    lineHeight: 16,
                  }}
                >
                  ✓
                </Text>
              ) : null}
            </View>
            <Text
              style={{
                color: t.ink,
                fontFamily: font.sansMed,
                fontSize: 13,
                flex: 1,
              }}
            >
              I understand these conflicts and accept the risk
            </Text>
          </Pressable>
        </>
      ) : (
        <View
          style={{
            padding: space.md,
            borderRadius: radius.lg,
            backgroundColor: t.successSoft,
            borderWidth: 1,
            borderColor: t.success,
            marginBottom: space.md,
          }}
        >
          <Text
            style={{
              color: t.success,
              fontFamily: font.sansSemi,
              fontSize: 13,
            }}
          >
            ✓ No stacking conflicts detected
          </Text>
        </View>
      )}

      <DosingDisclaimer />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[styles.topBar, { borderBottomColor: t.line }]}>
        <Pressable
          onPress={handleBack}
          hitSlop={8}
          disabled={saving}
          accessibilityLabel="Back"
          style={[styles.topBarBtn, saving ? { opacity: 0.4 } : null]}
        >
          <IconChevronLeft color={t.ink} size={22} />
        </Pressable>
        <Text
          style={[
            styles.topBarTitle,
            { color: t.ink, fontFamily: font.sansSemi },
          ]}
        >
          New cycle
        </Text>
        <View style={styles.topBarBtn}>
          {step === 4 ? (
            <Pressable
              onPress={handleSave}
              disabled={!canAdvance}
              hitSlop={8}
              accessibilityLabel="Save cycle"
            >
              <Text
                style={{
                  color: canAdvance ? t.accent : t.ink4,
                  fontFamily: font.sansSemi,
                  fontSize: 15,
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {renderProgressBar()}

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingBottom: insets.bottom + 40,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {renderStepCounter()}
        {step === 1 ? renderStep1() : null}
        {step === 2 ? renderStep2() : null}
        {step === 3 ? renderStep3() : null}
        {step === 4 ? renderStep4() : null}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          gap: space.sm,
          paddingHorizontal: space.xl,
          paddingTop: space.md,
          paddingBottom: insets.bottom + space.md,
          borderTopWidth: 1,
          borderTopColor: t.line,
          backgroundColor: t.bg,
        }}
      >
        {step > 1 ? (
          <Pressable
            onPress={handleBack}
            disabled={saving}
            accessibilityLabel="Back"
            style={{
              flex: 1,
              height: 52,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              opacity: saving ? 0.4 : 1,
            }}
          >
            <Text
              style={{
                color: t.ink,
                fontFamily: font.sansSemi,
                fontSize: 15,
              }}
            >
              Back
            </Text>
          </Pressable>
        ) : null}

        {step === 4 ? (
          <Pressable
            onPress={handleSave}
            disabled={!canAdvance}
            accessibilityLabel="Save cycle"
            style={{
              flex: 2,
              height: 52,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: canAdvance ? t.ink : t.ink4,
              opacity: canAdvance ? 1 : 0.6,
            }}
          >
            <Text
              style={{
                color: t.bg,
                fontFamily: font.sansSemi,
                fontSize: 15,
              }}
            >
              {saving ? 'Saving…' : 'Save cycle'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleNext}
            disabled={!canAdvance}
            accessibilityLabel="Next"
            style={{
              flex: 2,
              height: 52,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: canAdvance ? t.ink : t.ink4,
              opacity: canAdvance ? 1 : 0.6,
            }}
          >
            <Text
              style={{
                color: t.bg,
                fontFamily: font.sansSemi,
                fontSize: 15,
              }}
            >
              Next
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
  },
  topBarBtn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 15,
  },
});
