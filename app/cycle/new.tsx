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
  const m = dose.match(/(\d+(?:\.\d+)?)\s*(mcg|mg)?/i);
  if (!m || m[1] === undefined) return 250;
  const n = parseFloat(m[1]);
  if (isNaN(n)) return 250;
  const unit = (m[2] ?? 'mcg').toLowerCase();
  return unit === 'mg' ? n * 1000 : n;
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

  const filteredTemplates = useMemo(
    () => TEMPLATES.filter((tpl) => tpl.goal === goal),
    [goal],
  );

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
    const dose = p ? parseDefaultDose(p.dose) : 250;
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
        <Text
          style={{
            color: t.ink,
            fontFamily: font.sansBold,
            fontSize: 17,
          }}
        >
          {tpl.name}
        </Text>
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
              No peptides match "{pickerQuery}"
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
            No peptides yet. Tap "Add peptide" above.
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
