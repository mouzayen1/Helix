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

const TIME_OPTIONS: string[] = ['morning', 'evening', 'pre-workout', 'pre-bed'];

const PHASE_OPTIONS: { id: Phase; label: string; desc: string }[] = [
  { id: 'loading', label: 'Loading', desc: 'Ramp-up phase' },
  { id: 'active', label: 'Active', desc: 'Main protocol' },
  { id: 'taper', label: 'Taper', desc: 'Wind-down' },
  { id: 'washout', label: 'Washout', desc: 'Rest between cycles' },
];

const TEMPLATES: Template[] = [
  {
    id: 'healing_classic',
    goal: 'Healing',
    name: 'Classic healing stack',
    duration_weeks: 4,
    phase: 'active',
    description: 'BPC-157 + TB-500 co-reconstituted. 4 weeks.',
    items: [
      { peptide_id: 'bpc157', dose_mcg: 250, freq: 'twice daily', time_of_day: 'morning' },
      { peptide_id: 'tb500', dose_mcg: 2500, freq: 'twice weekly', time_of_day: 'morning' },
    ],
  },
  {
    id: 'healing_plus',
    goal: 'Healing',
    name: 'Extended healing + skin',
    duration_weeks: 6,
    phase: 'active',
    description: 'BPC-157 + TB-500 + GHK-Cu. 6-week cycle.',
    items: [
      { peptide_id: 'bpc157', dose_mcg: 250, freq: 'twice daily', time_of_day: 'morning' },
      { peptide_id: 'tb500', dose_mcg: 2500, freq: 'twice weekly', time_of_day: 'morning' },
      { peptide_id: 'ghkcu', dose_mcg: 1000, freq: 'daily', time_of_day: 'evening' },
    ],
  },
  {
    id: 'growth_classic',
    goal: 'Growth',
    name: 'Ipamorelin + CJC (no DAC)',
    duration_weeks: 12,
    phase: 'active',
    description: 'Pulsatile GH stack. 3x daily. 12 weeks, 5-on/2-off.',
    items: [
      { peptide_id: 'ipamor', dose_mcg: 250, freq: 'twice daily', time_of_day: 'pre-bed' },
      { peptide_id: 'cjc_nodac', dose_mcg: 100, freq: 'twice daily', time_of_day: 'pre-bed' },
    ],
  },
  {
    id: 'growth_dac',
    goal: 'Growth',
    name: 'CJC-1295 DAC baseline',
    duration_weeks: 12,
    phase: 'active',
    description: 'Baseline GH/IGF-1 elevation. Weekly dosing.',
    items: [
      { peptide_id: 'cjc_dac', dose_mcg: 1000, freq: 'weekly', time_of_day: 'pre-bed' },
    ],
  },
  {
    id: 'fatloss_sema',
    goal: 'Fat-loss',
    name: 'Semaglutide titration',
    duration_weeks: 16,
    phase: 'loading',
    description: 'GLP-1 titration. Start low, increase every 4 weeks.',
    items: [
      { peptide_id: 'sema', dose_mcg: 250, freq: 'weekly', time_of_day: 'morning' },
    ],
  },
  {
    id: 'fatloss_stack',
    goal: 'Fat-loss',
    name: 'Sema + AOD-9604',
    duration_weeks: 12,
    phase: 'active',
    description: 'Weekly GLP-1 + daily lipolytic fragment.',
    items: [
      { peptide_id: 'sema', dose_mcg: 250, freq: 'weekly', time_of_day: 'morning' },
      { peptide_id: 'aod', dose_mcg: 300, freq: 'daily', time_of_day: 'morning' },
    ],
  },
  {
    id: 'cognitive_selank',
    goal: 'Cognitive',
    name: 'Selank (intranasal)',
    duration_weeks: 2,
    phase: 'active',
    description: 'Short anxiolytic course. 10-14 days.',
    items: [
      { peptide_id: 'selank', dose_mcg: 150, freq: 'twice daily', time_of_day: 'morning' },
    ],
  },
  {
    id: 'cognitive_semax',
    goal: 'Cognitive',
    name: 'Semax (intranasal)',
    duration_weeks: 2,
    phase: 'active',
    description: 'Short nootropic course. 10-14 days.',
    items: [
      { peptide_id: 'semax', dose_mcg: 250, freq: 'twice daily', time_of_day: 'morning' },
    ],
  },
  {
    id: 'longevity_epi',
    goal: 'Longevity',
    name: 'Epitalon course',
    duration_weeks: 3,
    phase: 'active',
    description: '10-20 day pineal course.',
    items: [
      { peptide_id: 'epi', dose_mcg: 10000, freq: 'daily', time_of_day: 'evening' },
    ],
  },
  {
    id: 'longevity_mito',
    goal: 'Longevity',
    name: 'SS-31 + NAD+',
    duration_weeks: 12,
    phase: 'active',
    description: 'Mitochondrial + NAD+ combination.',
    items: [
      { peptide_id: 'ss31', dose_mcg: 10000, freq: 'daily', time_of_day: 'morning' },
      { peptide_id: 'nad', dose_mcg: 250000, freq: 'daily', time_of_day: 'morning' },
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

  const filteredTemplates = useMemo(() => TEMPLATES.filter((tpl) => tpl.goal === goal), [goal]);

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

  const setDoseFromInput = (idx: number, peptide_id: string, raw: string): void => {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    setDoseText((prev) => ({ ...prev, [peptide_id]: cleaned }));
    const n = parseFloat(cleaned);
    updateItem(idx, { dose_mcg: isNaN(n) ? 0 : n });
  };

  const stepDoseBy = (
    idx: number,
    peptide_id: string,
    current: number,
    delta: number
  ): void => {
    const newDose = Math.max(0, current + delta);
    updateItem(idx, { dose_mcg: newDose });
    setDoseText((prev) => ({ ...prev, [peptide_id]: String(newDose) }));
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
        <View style={{ marginTop: 24 }}>
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
    const displayValue = doseText[it.peptide_id] ?? String(it.dose_mcg);
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

        <Text
          style={{
            marginTop: 14,
            fontFamily: ed.typography.labelSm.fontFamily,
            fontSize: ed.typography.labelSm.fontSize,
            letterSpacing: ed.typography.labelSm.letterSpacing,
            color: ed.colors.ink3,
            textTransform: 'uppercase',
          }}
        >
          Dose · mcg
        </Text>
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
            />
          ))}
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
          minusDisabled={startOffset === 0}
          plusDisabled={startOffset === MAX_START_OFFSET}
          onMinus={() => setStartOffset((d) => Math.max(0, d - 1))}
          onPlus={() => setStartOffset((d) => Math.min(MAX_START_OFFSET, d + 1))}
          display={
            startOffset === 0
              ? `Today · ${formatDate(startDate)}`
              : startOffset === 1
              ? `Tomorrow · ${formatDate(startDate)}`
              : `${formatDate(startDate)} · +${startOffset}d`
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
                    {it.dose_mcg} mcg · {it.freq} · {it.time_of_day}
                  </Text>
                </View>
                {idx < items.length - 1 ? <HairlineRow /> : null}
              </View>
            );
          })}
        </View>
      </View>

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
}: {
  active: boolean;
  label: string;
  tone?: 'ink' | 'brand';
  onPress: () => void;
  ed: EditorialTheme;
}) {
  const fill = tone === 'brand' ? ed.colors.brand : ed.colors.ink1;
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: active ? fill : 'transparent',
        borderWidth: 1,
        borderColor: active ? fill : ed.colors.lineStrong,
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
