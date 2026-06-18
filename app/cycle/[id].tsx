// Cycle detail — editorial rebuild. View mode rebuilt with hero ring +
// stat pair + editorial protocol rows. Edit mode keeps the same data
// flow (typed inputs, freq/time pickers, conflict guard) but is
// restyled in the editorial palette: hairline rows instead of card
// fills, mono labels, brass for the active state.
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { HairlineRow } from '../../components/editorial/HairlineRow';
import { HeroRing } from '../../components/editorial/HeroRing';
import { PhaseTimeline } from '../../components/editorial/PhaseTimeline';
import { ScheduleItem } from '../../components/editorial/ScheduleItem';
import { StatPair } from '../../components/editorial/StatPair';
import { useEditorialTheme } from '../../lib/design/theme';
import { DoseInputUnitChip } from '../../components/editorial/DoseUnitChip';
import { formatDose, resolveDoseUnit, type DoseUnit } from '../../lib/dose-format';
import {
  attachVialToCycle,
  detachVial,
  endCycle,
  getVialsForCycle,
  listCycles,
  listJournal,
  matchingVialsForCycle,
  pauseCycle,
  resumeCycle,
  updateCycle,
  type Cycle,
  type CycleProtocolItem,
  type JournalEntry,
  type Vial,
} from '../../lib/db';
import { syncCalendarSafe } from '../../lib/calendar-sync';
import {
  formatRelativeDue,
  getNextInjectionForCycle,
  getVialsNeededForCycle,
  type NextInjection,
  type VialNeed,
} from '../../lib/cycle-helpers';
import { haptic } from '../../lib/haptics';
import { getPeptideExtras } from '../../lib/peptide-extras';
import { findPeptide, PEPTIDES } from '../../lib/peptides';

type ProtocolItem = CycleProtocolItem;

const FREQUENCIES = ['daily', 'twice daily', 'every other day', 'twice weekly', 'weekly'];
const TIMES = ['morning', 'evening', 'pre-workout', 'pre-bed'];

function parseDefaultDose(dose: string | undefined): number {
  if (!dose) return 250;
  const m = dose.match(/(\d+(?:\.\d+)?)/);
  if (!m || m[1] === undefined) return 250;
  const n = parseFloat(m[1]);
  if (isNaN(n)) return 250;
  return /\bmg\b/i.test(dose) ? n * 1000 : n;
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

export default function CycleDetail() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState('');
  const [phase, setPhase] = useState<Cycle['phase']>('active');
  const [status, setStatus] = useState<Cycle['status']>('active');
  const [items, setItems] = useState<ProtocolItem[]>([]);
  // Per-peptide input-mode override (mcg vs mg) for the edit stepper.
  // Defaults to mg when current mcg ≥ 1000. Local to this screen; never
  // touches the global dose_unit_pref.
  const [doseInputMode, setDoseInputMode] = useState<Record<string, DoseUnit>>({});
  const [startsOn, setStartsOn] = useState<string>('');
  const [durationWeeks, setDurationWeeks] = useState<number>(4);
  const [acceptConflicts, setAcceptConflicts] = useState<boolean>(false);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  // v1.2: vials currently attached to this cycle, plus the matching pool.
  const [attachedVials, setAttachedVials] = useState<Vial[]>([]);
  const [attachableVials, setAttachableVials] = useState<Vial[]>([]);
  const [vialNeeds, setVialNeeds] = useState<VialNeed[]>([]);
  const [nextInjections, setNextInjections] = useState<NextInjection[]>([]);

  const refresh = useCallback(async () => {
    const all = await listCycles();
    const c = all.find((x) => x.id === id) ?? null;
    setCycle(c);
    if (c) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const endBound = c.status === 'active' && c.ends_on > todayIso ? todayIso : c.ends_on;
      const journals = await listJournal(1000);
      setJournalEntries(
        journals.filter(
          (j) =>
            j.entry_date >= c.starts_on.slice(0, 10) && j.entry_date <= endBound.slice(0, 10)
        )
      );
      // Vial attachment state + next-injection countdown + vial-needed list.
      const [att, pool, needs, next] = await Promise.all([
        getVialsForCycle(c.id),
        matchingVialsForCycle(c),
        getVialsNeededForCycle(c.id),
        c.status === 'active'
          ? getNextInjectionForCycle(c.id)
          : Promise.resolve([] as NextInjection[]),
      ]);
      setAttachedVials(att);
      const attachedIds = new Set(att.map((v) => v.id));
      setAttachableVials(pool.filter((v) => !attachedIds.has(v.id)));
      setVialNeeds(needs);
      setNextInjections(next);
    } else {
      setJournalEntries([]);
      setAttachedVials([]);
      setAttachableVials([]);
      setVialNeeds([]);
      setNextInjections([]);
    }
    if (c) {
      setName(c.name);
      setPhase(c.phase);
      setStatus(c.status);
      setStartsOn(c.starts_on);
      const startD = new Date(c.starts_on);
      const endD = new Date(c.ends_on);
      const dayDelta = Math.max(1, Math.floor((endD.getTime() - startD.getTime()) / 864e5));
      setDurationWeeks(Math.max(1, Math.round(dayDelta / 7)));
      try {
        setItems(JSON.parse(c.protocol_json || '[]'));
      } catch {
        setItems([]);
      }
      setAcceptConflicts(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
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

  const isDirty = useMemo(() => {
    if (!cycle) return false;
    if (name.trim() !== cycle.name) return true;
    if (phase !== cycle.phase) return true;
    if (status !== cycle.status) return true;
    if (startsOn !== cycle.starts_on) return true;
    const startD = new Date(cycle.starts_on);
    const endD = new Date(cycle.ends_on);
    const origWeeks = Math.max(
      1,
      Math.round(Math.floor((endD.getTime() - startD.getTime()) / 864e5) / 7)
    );
    if (durationWeeks !== origWeeks) return true;
    try {
      const orig = JSON.parse(cycle.protocol_json || '[]');
      if (JSON.stringify(orig) !== JSON.stringify(items)) return true;
    } catch {
      return true;
    }
    return false;
  }, [cycle, name, phase, status, startsOn, durationWeeks, items]);

  if (!cycle) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: ed.colors.bg,
          paddingTop: insets.top + 24,
          paddingHorizontal: 24,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={{ fontFamily: ed.fraunces('Fraunces_300Light'), fontSize: 26, color: ed.colors.ink2 }}>
            ←
          </Text>
        </Pressable>
        <Text
          style={{
            marginTop: 32,
            fontFamily: ed.typography.label.fontFamily,
            fontSize: ed.typography.label.fontSize,
            letterSpacing: ed.typography.label.letterSpacing,
            color: ed.colors.ink3,
            textTransform: 'uppercase',
          }}
        >
          Loading
        </Text>
      </View>
    );
  }

  const start = new Date(cycle.starts_on);
  const end = new Date(cycle.ends_on);
  const today = new Date();
  const total = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 864e5));
  const dayIdx = Math.min(
    total,
    Math.max(0, Math.floor((today.getTime() - start.getTime()) / 864e5))
  );
  const day = Math.min(total, dayIdx + 1);
  const pct = Math.round((dayIdx / total) * 100);

  const editStartDate = startsOn ? new Date(startsOn) : new Date(cycle.starts_on);
  const editEndDate = addDays(editStartDate, durationWeeks * 7);

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateCycle(cycle.id, {
        name: name.trim() || cycle.name,
        phase,
        status,
        starts_on: isoDate(editStartDate),
        ends_on: isoDate(editEndDate),
        protocol: items,
      });
      setEditing(false);
      void syncCalendarSafe();
      refresh();
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : 'Please try again.';
      Alert.alert('Could not save cycle', msg, [{ text: 'OK' }]);
    } finally {
      setSaving(false);
    }
  };

  const onEndCycle = async () => {
    await endCycle(cycle.id);
    void syncCalendarSafe();
    router.back();
  };
  const onPauseCycle = async () => {
    await pauseCycle(cycle.id);
    void syncCalendarSafe();
    haptic.warn();
    router.back();
  };
  const onResumeCycle = async () => {
    await resumeCycle(cycle.id);
    void syncCalendarSafe();
    haptic.success();
    router.back();
  };

  // v1.2: attach a vial to this cycle. Single-owner — if attached
  // elsewhere, that link is overwritten after a confirmation alert.
  const onAttachVial = async (v: Vial) => {
    const stale = v.cycle_id && v.cycle_id !== cycle.id;
    const proceed = async () => {
      await attachVialToCycle(v.id, cycle.id);
      await refresh();
    };
    if (stale) {
      Alert.alert(
        'Move vial to this cycle?',
        'This vial is currently attached to another cycle. Moving it here will detach it from the other cycle. Doses already logged stay where they are.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Move', onPress: () => void proceed() },
        ]
      );
      return;
    }
    await proceed();
  };

  const onDetachVial = (v: Vial) => {
    Alert.alert(
      'Detach vial?',
      'The vial returns to free inventory. Doses logged from it keep their existing cycle linkage — detaching the vial does not rewrite history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Detach',
          style: 'destructive',
          onPress: async () => {
            await detachVial(v.id);
            await refresh();
          },
        },
      ]
    );
  };

  const handleBack = () => {
    if (editing && isDirty) {
      Alert.alert('Discard changes?', 'Your edits will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setEditing(false);
            refresh();
          },
        },
      ]);
      return;
    }
    if (editing) {
      setEditing(false);
      return;
    }
    router.back();
  };

  const addPeptide = (pid: string) => {
    const p = findPeptide(pid)!;
    const defaultDose = p.defaultDoseMcg ?? parseDefaultDose(p.dose);
    setItems((prev) => [
      ...prev,
      { peptide_id: pid, dose_mcg: defaultDose, freq: 'daily', time_of_day: 'morning' },
    ]);
    setShowPicker(false);
  };
  const updateItem = (i: number, patch: Partial<ProtocolItem>) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };
  const removeItem = (i: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  };

  const canSave = !saving && (conflicts.length === 0 || acceptConflicts);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: ed.colors.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 64 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Top bar */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: 24,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Pressable onPress={handleBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
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
        {editing ? (
          <Pressable onPress={onSave} disabled={!canSave} hitSlop={6}>
            <Text
              style={{
                fontFamily: ed.typography.label.fontFamily,
                fontSize: ed.typography.label.fontSize,
                letterSpacing: ed.typography.label.letterSpacing,
                color: !canSave ? ed.colors.ink3 : ed.colors.brand,
                textTransform: 'uppercase',
              }}
            >
              {saving ? 'Saving' : 'Save'}
            </Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setEditing(true)} hitSlop={6}>
            <Text
              style={{
                fontFamily: ed.typography.label.fontFamily,
                fontSize: ed.typography.label.fontSize,
                letterSpacing: ed.typography.label.letterSpacing,
                color: ed.colors.brand,
                textTransform: 'uppercase',
              }}
            >
              Edit
            </Text>
          </Pressable>
        )}
      </View>

      <View style={{ paddingHorizontal: 24 }}>
        <Text
          style={{
            fontFamily: ed.typography.eyebrow.fontFamily,
            fontSize: ed.typography.eyebrow.fontSize,
            letterSpacing: ed.typography.eyebrow.letterSpacing,
            color: ed.colors.brand,
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          {status} · {phase}
        </Text>
        {editing ? (
          <TextInput
            value={name}
            onChangeText={setName}
            selectionColor={ed.colors.brand}
            style={{
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 32,
              lineHeight: 36,
              letterSpacing: -0.8,
              color: ed.colors.ink1,
              padding: 0,
              borderBottomWidth: 1,
              borderBottomColor: ed.colors.line,
              paddingBottom: 6,
            }}
          />
        ) : (
          <EditorialHeadline size="title1">{cycle.name}</EditorialHeadline>
        )}
        <Text
          style={{
            marginTop: 8,
            fontFamily: ed.typography.dataMd.fontFamily,
            fontSize: ed.typography.dataMd.fontSize,
            color: ed.colors.ink3,
          }}
        >
          {formatDate(start)} → {formatDate(end)}
        </Text>

        {/* Next-injection countdown — active cycles only, non-PRN peptides. */}
        {!editing &&
        cycle.status === 'active' &&
        nextInjections.some((n) => n.state !== 'prn') ? (
          <View style={{ marginTop: 18 }}>
            <Text
              style={{
                fontFamily: ed.typography.labelSm.fontFamily,
                fontSize: ed.typography.labelSm.fontSize,
                letterSpacing: ed.typography.labelSm.letterSpacing,
                color: ed.colors.ink3,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Next injection
            </Text>
            {nextInjections
              .filter((n) => n.state !== 'prn')
              .map((n) => {
                if (n.state === 'pending_first_dose') {
                  return (
                    <Text
                      key={n.peptide_id}
                      style={{
                        fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                        fontSize: 15,
                        lineHeight: 22,
                        color: ed.colors.ink2,
                      }}
                    >
                      {n.peptide_name} — log first dose to start tracking
                    </Text>
                  );
                }
                const overdue = n.state === 'overdue';
                return (
                  <Text
                    key={n.peptide_id}
                    style={{
                      fontFamily: ed.fraunces('Fraunces_400Regular'),
                      fontSize: 16,
                      lineHeight: 24,
                      letterSpacing: -0.2,
                      color: overdue ? ed.colors.stateWarn : ed.colors.ink1,
                    }}
                  >
                    {n.peptide_name} · {n.due_at ? formatRelativeDue(n.due_at) : ''}
                    {overdue ? ' (overdue)' : ''}
                  </Text>
                );
              })}
          </View>
        ) : null}
      </View>

      {/* Vial-needed banner — active cycles where any peptide doesn't have
          a reconstituted vial. Tap → opens reconstitute pre-pinned. */}
      {!editing &&
      cycle.status === 'active' &&
      vialNeeds.some((v) => !v.has_active_vial) ? (
        <Pressable
          onPress={() => {
            const first = vialNeeds.find((v) => !v.has_active_vial);
            if (first) {
              router.push({
                pathname: '/reconstitute',
                params: { peptideId: first.peptide_id, cycleId: cycle.id },
              } as any);
            }
          }}
          style={{
            marginHorizontal: 24,
            marginTop: 24,
            paddingVertical: 16,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: ed.colors.stateWarn,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: ed.typography.label.fontFamily,
                fontSize: ed.typography.label.fontSize,
                letterSpacing: ed.typography.label.letterSpacing,
                color: ed.colors.stateWarn,
                textTransform: 'uppercase',
              }}
            >
              {vialNeeds.filter((v) => !v.has_active_vial).length === 1
                ? '1 peptide needs a vial'
                : `${vialNeeds.filter((v) => !v.has_active_vial).length} peptides need a vial`}
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontFamily: ed.fraunces('Fraunces_400Regular'),
                fontSize: 16,
                lineHeight: 22,
                color: ed.colors.ink1,
              }}
            >
              {vialNeeds
                .filter((v) => !v.has_active_vial)
                .map((v) => v.peptide_name)
                .join(' · ')}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: ed.typography.label.fontFamily,
              fontSize: ed.typography.label.fontSize,
              letterSpacing: ed.typography.label.letterSpacing,
              color: ed.colors.stateWarn,
              textTransform: 'uppercase',
            }}
          >
            Reconstitute →
          </Text>
        </Pressable>
      ) : null}

      {/* View-mode hero + stats */}
      {!editing ? (
        <>
          <View style={{ alignItems: 'center', marginTop: 28 }}>
            <HeroRing
              value={pct}
              unit="%"
              label={`Day ${day} of ${total}`}
              color={
                cycle.status === 'paused'
                  ? 'stateWarn'
                  : cycle.status === 'complete'
                  ? 'stateGood'
                  : 'brand'
              }
            />
          </View>
          <View style={{ marginTop: 28, marginHorizontal: 24 }}>
            <HairlineRow strong />
            <StatPair
              cells={[
                { value: day, unit: `/${total}`, label: 'Day' },
                { value: pct, unit: '%', label: 'Progress' },
                { value: Math.max(0, total - dayIdx), unit: 'd', label: 'Remaining' },
              ]}
            />
            <HairlineRow strong />
          </View>
        </>
      ) : null}

      {/* Edit-mode start date + duration */}
      {editing ? (
        <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>Start date</EyebrowLabel>
          <DateAdjuster
            value={editStartDate}
            onChange={(d) => setStartsOn(isoDate(d))}
            display={formatDate(editStartDate)}
          />
          <EyebrowLabel withRule style={{ marginTop: 24 }}>{`Duration · ends ${formatDate(editEndDate)}`}</EyebrowLabel>
          <Stepper
            value={durationWeeks}
            unit={durationWeeks === 1 ? 'week' : 'weeks'}
            onMinus={() => setDurationWeeks((w) => Math.max(1, w - 1))}
            onPlus={() => setDurationWeeks((w) => Math.min(52, w + 1))}
          />
        </View>
      ) : null}

      {/* Edit-mode phase + status */}
      {editing ? (
        <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>Phase</EyebrowLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {(['loading', 'active', 'taper', 'washout'] as const).map((ph) => (
              <Chip key={ph} active={ph === phase} label={ph} onPress={() => setPhase(ph)} />
            ))}
          </View>
          <EyebrowLabel withRule style={{ marginTop: 24 }}>Status</EyebrowLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {(['active', 'complete', 'cancelled'] as const).map((s) => (
              <Chip
                key={s}
                active={s === status}
                label={s}
                tone="brand"
                onPress={() => setStatus(s)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* Protocol */}
      <View
        style={{
          marginTop: 36,
          paddingHorizontal: 24,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: ed.typography.eyebrow.fontFamily,
            fontSize: ed.typography.eyebrow.fontSize,
            letterSpacing: ed.typography.eyebrow.letterSpacing,
            color: ed.colors.ink3,
            textTransform: 'uppercase',
          }}
        >
          Protocol · {items.length}
        </Text>
        {editing ? (
          <Pressable onPress={() => setShowPicker((v) => !v)} hitSlop={6}>
            <Text
              style={{
                fontFamily: ed.typography.label.fontFamily,
                fontSize: ed.typography.label.fontSize,
                letterSpacing: ed.typography.label.letterSpacing,
                color: ed.colors.brand,
                textTransform: 'uppercase',
              }}
            >
              + Add
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ marginHorizontal: 24, marginTop: 4 }}>
        <HairlineRow />
      </View>

      {editing && showPicker ? (
        <View
          style={{
            marginTop: 8,
            marginHorizontal: 24,
            maxHeight: 280,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: ed.colors.line,
          }}
        >
          <ScrollView nestedScrollEnabled>
            {PEPTIDES.map((p, idx) => (
              <View key={p.id}>
                <Pressable
                  onPress={() => addPeptide(p.id)}
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 4,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.color }} />
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: ed.fraunces('Fraunces_400Regular'),
                      fontSize: 16,
                      color: ed.colors.ink1,
                    }}
                  >
                    {p.name}
                  </Text>
                </Pressable>
                {idx < PEPTIDES.length - 1 ? <HairlineRow /> : null}
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {!editing
        ? (() => {
            // Map each item's phases into PhaseTimeline-friendly slices.
            // Last phase fills the rest of the cycle since we don't store
            // its explicit length on disk; previous phases use the next
            // phase's startWeek - this phase's startWeek.
            const totalDays = total;
            const totalWeeks = Math.max(1, Math.ceil(totalDays / 7) + 1);
            const phased = items
              .map((row, i) => {
                const phases = row.phases ?? [];
                if (phases.length < 2) return null;
                const sorted = phases.slice().sort((a, b) => a.startWeek - b.startWeek);
                const slices = sorted.map((p, pi) => {
                  const nextStart = sorted[pi + 1]?.startWeek ?? totalWeeks;
                  return {
                    name: p.name ?? `Phase ${pi + 1}`,
                    days: Math.max(1, (nextStart - p.startWeek) * 7),
                  };
                });
                return { row, slices, key: `${row.peptide_id}-${i}` };
              })
              .filter((x): x is { row: typeof items[number]; slices: { name: string; days: number }[]; key: string } => !!x);
            if (phased.length === 0) return null;
            const single = phased.length === 1;
            return (
              <View style={{ paddingHorizontal: 24, marginTop: 18 }}>
                <EyebrowLabel withRule>
                  {single ? 'Phase timeline' : `Phase timelines · ${phased.length}`}
                </EyebrowLabel>
                {single
                  ? (() => {
                      const ph = phased[0];
                      return (
                        <View style={{ marginTop: 8 }}>
                          <Text
                            style={{
                              fontFamily: ed.fraunces('Fraunces_400Regular'),
                              fontSize: 18,
                              color: ed.colors.ink1,
                            }}
                          >
                            {findPeptide(ph.row.peptide_id)?.name ?? ph.row.peptide_id}
                          </Text>
                          <PhaseTimeline phases={ph.slices} currentDay={day} />
                        </View>
                      );
                    })()
                  : (
                    // Multiple phased peptides → collapsible to keep cycle
                    // detail from getting visually heavy.
                    <CollapsibleTimelines
                      items={phased.map((ph) => ({
                        key: ph.key,
                        name: findPeptide(ph.row.peptide_id)?.name ?? ph.row.peptide_id,
                        slices: ph.slices,
                      }))}
                      currentDay={day}
                    />
                  )}
              </View>
            );
          })()
        : null}

      <View style={{ paddingHorizontal: 24 }}>
        {items.map((row, i) => {
          const p = findPeptide(row.peptide_id);
          if (!editing) {
            const time =
              row.time_of_day === 'morning'
                ? 'AM'
                : row.time_of_day === 'evening'
                ? 'PM'
                : row.time_of_day.slice(0, 4).toUpperCase();
            return (
              <View key={i}>
                <ScheduleItem
                  time={time}
                  title={p?.name ?? row.peptide_id}
                  detail={row.freq}
                  doseMcg={row.dose_mcg}
                  status="upcoming"
                />
                {i < items.length - 1 ? <HairlineRow /> : null}
              </View>
            );
          }
          return (
            <View
              key={i}
              style={{
                paddingVertical: 18,
                gap: 12,
                borderBottomWidth: i < items.length - 1 ? 1 : 0,
                borderBottomColor: ed.colors.line,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: p?.color ?? ed.colors.ink3,
                  }}
                />
                <Text
                  style={{
                    flex: 1,
                    fontFamily: ed.fraunces('Fraunces_400Regular'),
                    fontSize: 18,
                    color: ed.colors.ink1,
                  }}
                >
                  {p?.name ?? row.peptide_id}
                </Text>
                <Pressable onPress={() => removeItem(i)} hitSlop={6}>
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
              {(() => {
                const inputMode =
                  doseInputMode[row.peptide_id] ?? resolveDoseUnit(row.dose_mcg, 'auto');
                const formatted = formatDose(row.dose_mcg, inputMode);
                return (
                  <View>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'flex-end',
                        marginTop: 6,
                      }}
                    >
                      <DoseInputUnitChip
                        mode={inputMode}
                        onChange={(next) =>
                          setDoseInputMode((prev) => ({ ...prev, [row.peptide_id]: next }))
                        }
                      />
                    </View>
                    <Stepper
                      value={row.dose_mcg}
                      display={formatted.value}
                      unit={formatted.unit}
                      onMinus={() =>
                        updateItem(i, {
                          dose_mcg: Math.max(1, row.dose_mcg - doseStepFor(row.dose_mcg)),
                        })
                      }
                      onPlus={() =>
                        updateItem(i, {
                          dose_mcg: row.dose_mcg + doseStepFor(row.dose_mcg),
                        })
                      }
                    />
                  </View>
                );
              })()}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {FREQUENCIES.map((f) => (
                  <Chip
                    key={f}
                    active={f === row.freq}
                    label={f}
                    onPress={() => updateItem(i, { freq: f })}
                  />
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {TIMES.map((tod) => (
                  <Chip
                    key={tod}
                    active={tod === row.time_of_day}
                    label={tod}
                    tone="brand"
                    onPress={() => updateItem(i, { time_of_day: tod })}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>

      {/* Conflicts (edit mode) */}
      {editing && conflicts.length > 0 ? (
        <View style={{ marginTop: 24, paddingHorizontal: 24 }}>
          <View
            style={{
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: ed.colors.stateWarn,
              paddingVertical: 18,
              gap: 8,
            }}
          >
            <Text
              style={{
                fontFamily: ed.typography.label.fontFamily,
                fontSize: ed.typography.label.fontSize,
                letterSpacing: ed.typography.label.letterSpacing,
                color: ed.colors.stateWarn,
                textTransform: 'uppercase',
              }}
            >
              Stacking conflicts
            </Text>
            {conflicts.map((c) => {
              const a = findPeptide(c.a);
              const b = findPeptide(c.b);
              return (
                <Text
                  key={`${c.a}-${c.b}`}
                  style={{
                    fontFamily: ed.typography.bodySm.fontFamily,
                    fontSize: ed.typography.bodySm.fontSize,
                    lineHeight: ed.typography.bodySm.lineHeight,
                    color: ed.colors.ink2,
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
              alignItems: 'center',
              gap: 12,
            }}
          >
            <View
              style={{
                width: 18,
                height: 18,
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
                fontFamily: ed.typography.bodySm.fontFamily,
                fontSize: ed.typography.bodySm.fontSize,
                color: ed.colors.ink1,
              }}
            >
              I understand these conflicts and accept the risk.
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Vials attached to this cycle (view mode). Each row tap-detaches
          back to free inventory; matching but-not-attached vials below
          have an "Attach" affordance. */}
      {!editing && (attachedVials.length > 0 || attachableVials.length > 0) ? (
        <View style={{ marginTop: 36, paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>{`Vials · ${attachedVials.length} attached`}</EyebrowLabel>
          {attachedVials.length > 0 ? (
            <View style={{ marginTop: 4 }}>
              {attachedVials.map((v, idx) => {
                const p = findPeptide(v.peptide_id);
                const recon = new Date(v.reconstituted_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });
                return (
                  <View key={v.id}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 16,
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: p?.color ?? ed.colors.ink3,
                        }}
                      />
                      <Pressable
                        onPress={() => router.push(`/vials/${v.id}` as any)}
                        style={{ flex: 1 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${p?.name ?? v.peptide_id} vial`}
                      >
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
                            marginTop: 4,
                            fontFamily: ed.typography.dataMd.fontFamily,
                            fontSize: ed.typography.dataMd.fontSize,
                            color: ed.colors.ink3,
                          }}
                        >
                          {v.remaining_mg.toFixed(2)} / {v.strength_mg} mg · recon {recon}
                          {v.is_active === 0 ? ' · depleted' : ''}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => onDetachVial(v)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`Detach ${p?.name ?? v.peptide_id} vial`}
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
                          Detach
                        </Text>
                      </Pressable>
                    </View>
                    {idx < attachedVials.length - 1 ? <HairlineRow /> : null}
                  </View>
                );
              })}
            </View>
          ) : null}
          {attachableVials.length > 0 ? (
            <View style={{ marginTop: 18 }}>
              <Text
                style={{
                  fontFamily: ed.typography.labelSm.fontFamily,
                  fontSize: ed.typography.labelSm.fontSize,
                  letterSpacing: ed.typography.labelSm.letterSpacing,
                  color: ed.colors.ink3,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Attach existing vial
              </Text>
              {attachableVials.map((v, idx) => {
                const p = findPeptide(v.peptide_id);
                const stale = v.cycle_id && v.cycle_id !== cycle.id;
                return (
                  <View key={v.id}>
                    <Pressable
                      onPress={() => onAttachVial(v)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 14,
                        gap: 12,
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Attach ${p?.name ?? v.peptide_id} vial`}
                    >
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: p?.color ?? ed.colors.ink3,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontFamily: ed.fraunces('Fraunces_400Regular'),
                            fontSize: 17,
                            letterSpacing: -0.2,
                            color: ed.colors.ink2,
                          }}
                        >
                          {p?.name ?? v.peptide_id}
                        </Text>
                        <Text
                          style={{
                            marginTop: 4,
                            fontFamily: ed.typography.dataMd.fontFamily,
                            fontSize: ed.typography.dataMd.fontSize,
                            color: ed.colors.ink3,
                          }}
                        >
                          {v.remaining_mg.toFixed(2)} / {v.strength_mg} mg
                          {stale ? ' · in another cycle' : ''}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontFamily: ed.typography.label.fontFamily,
                          fontSize: ed.typography.label.fontSize,
                          letterSpacing: ed.typography.label.letterSpacing,
                          color: ed.colors.brand,
                          textTransform: 'uppercase',
                        }}
                      >
                        + Attach
                      </Text>
                    </Pressable>
                    {idx < attachableVials.length - 1 ? <HairlineRow /> : null}
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Journal entries during this cycle (view mode) */}
      {!editing && journalEntries.length > 0 ? (
        <View style={{ marginTop: 36, paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>{`Journal · ${journalEntries.length}`}</EyebrowLabel>
          <View style={{ marginTop: 4 }}>
            {journalEntries.map((j, idx) => (
              <View key={j.id}>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/journal-entry',
                      params: { date: j.entry_date },
                    } as any)
                  }
                  accessibilityRole="button"
                  style={{ paddingVertical: 16, gap: 4 }}
                >
                  <Text
                    style={{
                      fontFamily: ed.typography.dataMd.fontFamily,
                      fontSize: ed.typography.dataMd.fontSize,
                      color: ed.colors.ink3,
                    }}
                  >
                    {new Date(j.entry_date)
                      .toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })
                      .toUpperCase()}
                  </Text>
                  {j.body ? (
                    <Text
                      numberOfLines={2}
                      style={{
                        fontFamily: ed.fraunces('Fraunces_400Regular'),
                        fontSize: 17,
                        lineHeight: 24,
                        letterSpacing: -0.2,
                        color: ed.colors.ink1,
                      }}
                    >
                      {j.body}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 14, marginTop: 4 }}>
                    {j.mood != null ? (
                      <Text
                        style={{
                          fontFamily: ed.typography.labelSm.fontFamily,
                          fontSize: ed.typography.labelSm.fontSize,
                          letterSpacing: ed.typography.labelSm.letterSpacing,
                          color: ed.colors.ink3,
                          textTransform: 'uppercase',
                        }}
                      >
                        Mood {j.mood}
                      </Text>
                    ) : null}
                    {j.energy != null ? (
                      <Text
                        style={{
                          fontFamily: ed.typography.labelSm.fontFamily,
                          fontSize: ed.typography.labelSm.fontSize,
                          letterSpacing: ed.typography.labelSm.letterSpacing,
                          color: ed.colors.ink3,
                          textTransform: 'uppercase',
                        }}
                      >
                        Energy {j.energy}
                      </Text>
                    ) : null}
                    {j.sleep_hours != null ? (
                      <Text
                        style={{
                          fontFamily: ed.typography.labelSm.fontFamily,
                          fontSize: ed.typography.labelSm.fontSize,
                          letterSpacing: ed.typography.labelSm.letterSpacing,
                          color: ed.colors.ink3,
                          textTransform: 'uppercase',
                        }}
                      >
                        Sleep {j.sleep_hours}h
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
                {idx < journalEntries.length - 1 ? <HairlineRow /> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* View-mode actions */}
      {!editing ? (
        <View style={{ marginTop: 36, paddingHorizontal: 24, gap: 12 }}>
          {(cycle.status === 'complete' || cycle.status === 'cancelled') ? (
            <EditorialButton
              fullWidth
              onPress={() =>
                router.push({
                  pathname: '/cycle/new',
                  params: { copyFromCycleId: cycle.id },
                } as any)
              }
            >
              Copy to new cycle
            </EditorialButton>
          ) : null}
          {cycle.status === 'active' || cycle.status === 'paused' ? (
            <>
              <EditorialButton
                variant="secondary"
                fullWidth
                onPress={cycle.status === 'paused' ? onResumeCycle : onPauseCycle}
              >
                {cycle.status === 'paused' ? 'Resume cycle' : 'Pause cycle'}
              </EditorialButton>
              <EditorialButton variant="secondary" fullWidth onPress={onEndCycle}>
                End cycle
              </EditorialButton>
            </>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function Chip({
  active,
  label,
  tone = 'ink',
  onPress,
}: {
  active: boolean;
  label: string;
  tone?: 'ink' | 'brand';
  onPress: () => void;
}) {
  const ed = useEditorialTheme();
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
  value,
  unit,
  onMinus,
  onPlus,
  display,
}: {
  value: number;
  unit?: string;
  onMinus: () => void;
  onPlus: () => void;
  display?: string;
}) {
  const ed = useEditorialTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
      }}
    >
      <Pressable onPress={onMinus} hitSlop={8} accessibilityRole="button" accessibilityLabel="Decrease">
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
      <View style={{ flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
        <Text
          style={{
            fontFamily: ed.fraunces('Fraunces_400Regular'),
            fontSize: 24,
            letterSpacing: -0.4,
            color: ed.colors.ink1,
          }}
        >
          {display ?? value}
        </Text>
        {unit ? (
          <Text
            style={{
              marginLeft: 6,
              fontFamily: ed.typography.label.fontFamily,
              fontSize: ed.typography.label.fontSize,
              letterSpacing: ed.typography.label.letterSpacing,
              color: ed.colors.ink3,
              textTransform: 'uppercase',
            }}
          >
            {unit}
          </Text>
        ) : null}
      </View>
      <Pressable onPress={onPlus} hitSlop={8} accessibilityRole="button" accessibilityLabel="Increase">
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
  );
}

function DateAdjuster({
  value,
  onChange,
  display,
}: {
  value: Date;
  onChange: (d: Date) => void;
  display: string;
}) {
  return (
    <Stepper
      value={0}
      onMinus={() => onChange(addDays(value, -1))}
      onPlus={() => onChange(addDays(value, 1))}
      display={display}
    />
  );
}

function CollapsibleTimelines({
  items,
  currentDay,
}: {
  items: { key: string; name: string; slices: { name: string; days: number }[] }[];
  currentDay: number;
}) {
  const ed = useEditorialTheme();
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={{ marginTop: 8 }}>
      <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={6}>
        <Text
          style={{
            fontFamily: ed.typography.label.fontFamily,
            fontSize: ed.typography.label.fontSize,
            letterSpacing: ed.typography.label.letterSpacing,
            color: ed.colors.brand,
            textTransform: 'uppercase',
            paddingVertical: 8,
          }}
        >
          {expanded ? '− Hide' : '+ Show'}
        </Text>
      </Pressable>
      {expanded
        ? items.map((it) => (
            <View key={it.key} style={{ marginTop: 12 }}>
              <Text
                style={{
                  fontFamily: ed.fraunces('Fraunces_400Regular'),
                  fontSize: 18,
                  color: ed.colors.ink1,
                }}
              >
                {it.name}
              </Text>
              <PhaseTimeline phases={it.slices} currentDay={currentDay} />
            </View>
          ))
        : null}
    </View>
  );
}
