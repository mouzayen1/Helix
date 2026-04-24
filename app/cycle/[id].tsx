// Cycle detail — spec v2.0 §10. View + edit mode.
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronLeft, IconPlus } from '../../components/Icons';
import {
  endCycle,
  listCycles,
  listJournal,
  pauseCycle,
  resumeCycle,
  updateCycle,
  type Cycle,
  type JournalEntry,
} from '../../lib/db';
import { haptic } from '../../lib/haptics';
import { getPeptideExtras } from '../../lib/peptide-extras';
import { findPeptide, PEPTIDES } from '../../lib/peptides';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

type ProtocolItem = {
  peptide_id: string;
  dose_mcg: number;
  freq: string;
  time_of_day: string;
};

const FREQUENCIES = ['daily', 'twice daily', 'every other day', 'twice weekly', 'weekly'];
const TIMES = ['morning', 'evening', 'pre-workout', 'pre-bed'];

// Parse dose strings like "250 mcg", "1-2 mg", "10 mg/week" into a default
// dose value in micrograms (auto-converts mg → mcg).
function parseDefaultDose(dose: string | undefined): number {
  if (!dose) return 250;
  const m = dose.match(/(\d+(?:\.\d+)?)\s*(mcg|mg)?/i);
  if (!m || m[1] === undefined) return 250;
  const n = parseFloat(m[1]);
  if (isNaN(n)) return 250;
  const unit = (m[2] ?? 'mcg').toLowerCase();
  return unit === 'mg' ? n * 1000 : n;
}

// Adaptive dose step based on magnitude. Scales from ±10 at small doses
// to ±1000 at large doses so editing NAD+ (250k mcg) doesn't take 10,000 taps.
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
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [editing, setEditing] = useState(false);

  // Edit-mode state
  const [name, setName] = useState('');
  const [phase, setPhase] = useState<Cycle['phase']>('active');
  const [status, setStatus] = useState<Cycle['status']>('active');
  const [items, setItems] = useState<ProtocolItem[]>([]);
  const [startsOn, setStartsOn] = useState<string>('');
  const [durationWeeks, setDurationWeeks] = useState<number>(4);
  const [acceptConflicts, setAcceptConflicts] = useState<boolean>(false);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);

  const refresh = useCallback(async () => {
    const all = await listCycles();
    const c = all.find((x) => x.id === id) ?? null;
    setCycle(c);
    if (c) {
      // Journal entries whose entry_date falls within the cycle window.
      // For active cycles, the upper bound is today so future-dated entries
      // aren't included.
      const todayIso = new Date().toISOString().slice(0, 10);
      const endBound =
        c.status === 'active' && c.ends_on > todayIso ? todayIso : c.ends_on;
      const journals = await listJournal(1000);
      setJournalEntries(
        journals.filter(
          (j) => j.entry_date >= c.starts_on.slice(0, 10) && j.entry_date <= endBound.slice(0, 10)
        )
      );
    } else {
      setJournalEntries([]);
    }
    if (c) {
      setName(c.name);
      setPhase(c.phase);
      setStatus(c.status);
      setStartsOn(c.starts_on);
      const startD = new Date(c.starts_on);
      const endD = new Date(c.ends_on);
      const dayDelta = Math.max(
        1,
        Math.floor((endD.getTime() - startD.getTime()) / 864e5)
      );
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

  // Conflict detection across edited items (matches New Cycle Step 4 semantics).
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

  // Dirty check: does any editable field differ from the last-loaded cycle?
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
          backgroundColor: t.bg,
          paddingTop: insets.top + space.lg,
          paddingHorizontal: space.xl,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconChevronLeft size={18} color={t.ink2} />
        </Pressable>
        <Text style={{ marginTop: space.xl, color: t.ink3 }}>Loading…</Text>
      </View>
    );
  }

  // View-mode progress math (1-indexed display)
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

  // Edit-mode derived dates
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
      refresh();
    } catch (e) {
      const msg =
        e instanceof Error && e.message ? e.message : 'Please try again.';
      Alert.alert('Could not save cycle', msg, [{ text: 'OK' }]);
    } finally {
      setSaving(false);
    }
  };

  const onEndCycle = async () => {
    await endCycle(cycle.id);
    router.back();
  };

  const onPauseCycle = async () => {
    await pauseCycle(cycle.id);
    haptic.warn();
    router.back();
  };

  const onResumeCycle = async () => {
    await resumeCycle(cycle.id);
    haptic.success();
    router.back();
  };

  // Back-button with discard prompt when there are unsaved edits.
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
    const defaultDose = parseDefaultDose(p.dose);
    setItems((prev) => [
      ...prev,
      {
        peptide_id: pid,
        dose_mcg: defaultDose,
        freq: 'daily',
        time_of_day: 'morning',
      },
    ]);
    setShowPicker(false);
  };

  const updateItem = (i: number, patch: Partial<ProtocolItem>) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };

  const removeItem = (i: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  };

  // Save is blocked if conflicts exist and the user hasn't accepted them.
  const canSave = !saving && (conflicts.length === 0 || acceptConflicts);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Top bar */}
      <View
        style={{
          paddingTop: insets.top + space.sm,
          paddingBottom: space.md,
          paddingHorizontal: space.xl,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Pressable onPress={handleBack} hitSlop={8}>
          <IconChevronLeft size={18} color={t.ink2} />
        </Pressable>
        {editing ? (
          <Pressable onPress={onSave} disabled={!canSave}>
            <Text
              style={{
                color: !canSave ? t.ink3 : t.accent,
                fontSize: 14,
                fontFamily: font.sansSemi,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setEditing(true)}>
            <Text style={{ color: t.accent, fontSize: 14, fontFamily: font.sansSemi }}>
              Edit
            </Text>
          </Pressable>
        )}
      </View>

      <View style={{ paddingHorizontal: space.xl }}>
        <Text
          style={{
            color: t.accent,
            fontSize: 11,
            fontFamily: font.sansSemi,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          {status} · {phase}
        </Text>
        {editing ? (
          <TextInput
            value={name}
            onChangeText={setName}
            style={{
              marginTop: 4,
              fontSize: 26,
              fontFamily: font.sansBold,
              color: t.ink,
              letterSpacing: -0.6,
              padding: 0,
              borderBottomWidth: 1,
              borderBottomColor: t.line,
            }}
          />
        ) : (
          <Text
            style={{
              fontSize: 26,
              fontFamily: font.sansBold,
              color: t.ink,
              letterSpacing: -0.6,
              marginTop: 4,
            }}
          >
            {cycle.name}
          </Text>
        )}
        <Text style={{ color: t.ink3, fontSize: 13, fontFamily: font.mono, marginTop: 2 }}>
          {cycle.starts_on} → {cycle.ends_on}
        </Text>
      </View>

      {/* Progress (view mode only) */}
      {!editing ? (
        <View
          style={{
            marginHorizontal: space.xl,
            marginTop: space.lg,
            padding: space.lg,
            backgroundColor: t.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: t.line,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 8,
            }}
          >
            <Text style={{ color: t.ink, fontSize: 15, fontFamily: font.sansSemi }}>
              Day {day} of {total}
            </Text>
            <Text style={{ color: t.ink4, fontSize: 11, fontFamily: font.mono, marginTop: 2 }}>
              {formatDate(start)} — {formatDate(end)}
            </Text>
            <Text style={{ color: t.ink3, fontSize: 13, fontFamily: font.mono }}>
              {pct}% complete
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 2 }}>
            {Array.from({ length: Math.min(total, 60) }).map((_, i) => {
              const scaledI = Math.floor((i * total) / Math.min(total, 60));
              return (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 16,
                    borderRadius: 2,
                    backgroundColor: scaledI < day ? t.accent : t.surfaceAlt,
                  }}
                />
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Start date + duration editors (edit mode) */}
      {editing ? (
        <View style={{ paddingHorizontal: space.xl, marginTop: space.lg, gap: space.md }}>
          <View>
            <Text
              style={{
                fontSize: 11,
                color: t.ink3,
                letterSpacing: 0.9,
                fontFamily: font.sansSemi,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Start date
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
              }}
            >
              <Pressable
                onPress={() => setStartsOn(isoDate(addDays(editStartDate, -1)))}
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
                }}
              >
                <Text style={{ color: t.ink, fontSize: 20, fontFamily: font.sansBold }}>−</Text>
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
                <Text style={{ color: t.ink, fontFamily: font.monoSemi, fontSize: 14 }}>
                  {formatDate(editStartDate)}
                </Text>
              </View>
              <Pressable
                onPress={() => setStartsOn(isoDate(addDays(editStartDate, 1)))}
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
                }}
              >
                <Text style={{ color: t.ink, fontSize: 20, fontFamily: font.sansBold }}>+</Text>
              </Pressable>
            </View>
          </View>

          <View>
            <Text
              style={{
                fontSize: 11,
                color: t.ink3,
                letterSpacing: 0.9,
                fontFamily: font.sansSemi,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Duration (weeks) · ends {formatDate(editEndDate)}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
              }}
            >
              <Pressable
                onPress={() => setDurationWeeks((w) => Math.max(1, w - 1))}
                disabled={durationWeeks === 1}
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
                <Text style={{ color: t.ink, fontSize: 20, fontFamily: font.sansBold }}>−</Text>
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
                <Text style={{ color: t.ink, fontFamily: font.monoSemi, fontSize: 16 }}>
                  {durationWeeks} {durationWeeks === 1 ? 'week' : 'weeks'}
                </Text>
              </View>
              <Pressable
                onPress={() => setDurationWeeks((w) => Math.min(52, w + 1))}
                disabled={durationWeeks === 52}
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
                <Text style={{ color: t.ink, fontSize: 20, fontFamily: font.sansBold }}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {/* Phase + status editors (edit mode) */}
      {editing ? (
        <View style={{ paddingHorizontal: space.xl, marginTop: space.lg, gap: space.md }}>
          <View>
            <Text
              style={{
                fontSize: 11,
                color: t.ink3,
                letterSpacing: 0.9,
                fontFamily: font.sansSemi,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Phase
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {(['loading', 'active', 'taper', 'washout'] as const).map((ph) => {
                const active = ph === phase;
                return (
                  <Pressable
                    key={ph}
                    onPress={() => setPhase(ph)}
                    style={{
                      paddingVertical: 7,
                      paddingHorizontal: 13,
                      borderRadius: radius.pill,
                      backgroundColor: active ? t.ink : 'transparent',
                      borderWidth: 1,
                      borderColor: active ? t.ink : t.line,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: active ? t.bg : t.ink2,
                        fontFamily: font.sansMed,
                        textTransform: 'capitalize',
                      }}
                    >
                      {ph}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View>
            <Text
              style={{
                fontSize: 11,
                color: t.ink3,
                letterSpacing: 0.9,
                fontFamily: font.sansSemi,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Status
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {(['active', 'complete', 'cancelled'] as const).map((s) => {
                const active = s === status;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setStatus(s)}
                    style={{
                      paddingVertical: 7,
                      paddingHorizontal: 13,
                      borderRadius: radius.pill,
                      backgroundColor: active ? t.accent : 'transparent',
                      borderWidth: 1,
                      borderColor: active ? t.accent : t.line,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: active ? '#fff' : t.ink2,
                        fontFamily: font.sansMed,
                        textTransform: 'capitalize',
                      }}
                    >
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      ) : null}

      {/* Protocol list */}
      <View
        style={{
          marginTop: space.xl,
          paddingHorizontal: space.xl,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 11,
            letterSpacing: 1.2,
            fontFamily: font.sansSemi,
            textTransform: 'uppercase',
            color: t.ink3,
          }}
        >
          Protocol ({items.length})
        </Text>
        {editing ? (
          <Pressable
            onPress={() => setShowPicker(!showPicker)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: t.line,
            }}
            hitSlop={6}
          >
            <IconPlus size={12} color={t.ink2} />
            <Text style={{ color: t.ink2, fontSize: 12, fontFamily: font.sansMed }}>
              Add peptide
            </Text>
          </Pressable>
        ) : null}
      </View>

      {editing && showPicker ? (
        <View
          style={{
            marginTop: 8,
            marginHorizontal: space.xl,
            maxHeight: 300,
            backgroundColor: t.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: t.line,
          }}
        >
          <ScrollView nestedScrollEnabled>
            {PEPTIDES.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => addPeptide(p.id)}
                style={{
                  padding: space.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: t.line,
                }}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.color }} />
                <Text style={{ flex: 1, color: t.ink, fontSize: 14, fontFamily: font.sansMed }}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: space.xl, marginTop: space.sm, gap: 8 }}>
        {items.map((row, i) => {
          const p = findPeptide(row.peptide_id);
          return (
            <View
              key={i}
              style={{
                backgroundColor: t.surface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: t.line,
                padding: space.md,
                gap: editing ? space.sm : 0,
                flexDirection: editing ? 'column' : 'row',
                alignItems: editing ? 'stretch' : 'center',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: p?.color ?? t.ink3,
                  }}
                />
                <Text style={{ flex: 1, color: t.ink, fontSize: 14, fontFamily: font.sansSemi }}>
                  {p?.name ?? row.peptide_id}
                </Text>
                {editing ? (
                  <Pressable onPress={() => removeItem(i)} hitSlop={6}>
                    <Text style={{ color: t.danger, fontSize: 12, fontFamily: font.sansSemi }}>
                      Remove
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={{ color: t.ink3, fontSize: 12, fontFamily: font.mono }}>
                    {row.dose_mcg} mcg · {row.freq} · {row.time_of_day}
                  </Text>
                )}
              </View>

              {editing ? (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      padding: 6,
                      borderRadius: radius.sm,
                      backgroundColor: t.surfaceAlt,
                    }}
                  >
                    <Pressable
                      onPress={() =>
                        updateItem(i, {
                          dose_mcg: Math.max(1, row.dose_mcg - doseStepFor(row.dose_mcg)),
                        })
                      }
                      hitSlop={6}
                    >
                      <Text style={{ fontSize: 16, color: t.ink, paddingHorizontal: 6 }}>−</Text>
                    </Pressable>
                    <Text
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        fontSize: 14,
                        fontFamily: font.monoSemi,
                        color: t.ink,
                      }}
                    >
                      {row.dose_mcg} mcg
                    </Text>
                    <Pressable
                      onPress={() =>
                        updateItem(i, {
                          dose_mcg: row.dose_mcg + doseStepFor(row.dose_mcg),
                        })
                      }
                      hitSlop={6}
                    >
                      <Text style={{ fontSize: 16, color: t.ink, paddingHorizontal: 6 }}>+</Text>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                    {FREQUENCIES.map((f) => {
                      const active = f === row.freq;
                      return (
                        <Pressable
                          key={f}
                          onPress={() => updateItem(i, { freq: f })}
                          style={{
                            paddingVertical: 4,
                            paddingHorizontal: 10,
                            borderRadius: radius.pill,
                            backgroundColor: active ? t.ink : 'transparent',
                            borderWidth: 1,
                            borderColor: active ? t.ink : t.line,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              color: active ? t.bg : t.ink2,
                              fontFamily: font.sansMed,
                            }}
                          >
                            {f}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {TIMES.map((tod) => {
                      const active = tod === row.time_of_day;
                      return (
                        <Pressable
                          key={tod}
                          onPress={() => updateItem(i, { time_of_day: tod })}
                          style={{
                            flex: 1,
                            paddingVertical: 6,
                            borderRadius: radius.pill,
                            backgroundColor: active ? t.accent : 'transparent',
                            borderWidth: 1,
                            borderColor: active ? t.accent : t.line,
                            alignItems: 'center',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              color: active ? '#fff' : t.ink2,
                              fontFamily: font.sansMed,
                            }}
                          >
                            {tod}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Stack-conflict warnings (edit mode) */}
      {editing && conflicts.length > 0 ? (
        <View style={{ paddingHorizontal: space.xl, marginTop: space.lg }}>
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
                    style={{ color: t.ink, fontFamily: font.sans, fontSize: 13 }}
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
        </View>
      ) : null}

      {/* Journal during this cycle (view mode) */}
      {!editing && journalEntries.length > 0 ? (
        <View style={{ marginHorizontal: space.xl, marginTop: space.xl, gap: 8 }}>
          <Text
            style={{
              fontSize: 11,
              letterSpacing: 1,
              color: t.ink3,
              fontFamily: font.sansSemi,
              textTransform: 'uppercase',
            }}
          >
            Journal during this cycle · {journalEntries.length}
          </Text>
          {journalEntries.map((j) => (
            <Pressable
              key={j.id}
              onPress={() =>
                router.push({ pathname: '/journal-entry', params: { date: j.entry_date } } as any)
              }
              accessibilityRole="button"
              accessibilityLabel={`Open journal ${j.entry_date}`}
              style={{
                backgroundColor: t.surface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: t.line,
                padding: space.md,
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 12, color: t.ink3, fontFamily: font.mono }}>
                {new Date(j.entry_date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
              {j.body ? (
                <Text numberOfLines={2} style={{ fontSize: 13, color: t.ink, lineHeight: 19 }}>
                  {j.body}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
                {j.mood != null ? (
                  <Text style={{ fontSize: 11, color: t.ink3, fontFamily: font.mono }}>
                    mood {j.mood}
                  </Text>
                ) : null}
                {j.energy != null ? (
                  <Text style={{ fontSize: 11, color: t.ink3, fontFamily: font.mono }}>
                    energy {j.energy}
                  </Text>
                ) : null}
                {j.sleep_hours != null ? (
                  <Text style={{ fontSize: 11, color: t.ink3, fontFamily: font.mono }}>
                    sleep {j.sleep_hours}h
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Copy to new cycle (view mode, completed/cancelled cycles only) */}
      {!editing && (cycle.status === 'complete' || cycle.status === 'cancelled') ? (
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/cycle/new',
              params: { copyFromCycleId: cycle.id },
            } as any)
          }
          accessibilityRole="button"
          accessibilityLabel="Copy to new cycle"
          style={{
            marginHorizontal: space.xl,
            marginTop: space.xl,
            padding: space.md,
            borderRadius: radius.md,
            backgroundColor: t.ink,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: t.bg, fontSize: 14, fontFamily: font.sansSemi }}>
            Copy to new cycle
          </Text>
        </Pressable>
      ) : null}

      {/* Pause / resume action (view mode, for active or paused cycles) */}
      {!editing && (cycle.status === 'active' || cycle.status === 'paused') ? (
        <Pressable
          onPress={cycle.status === 'paused' ? onResumeCycle : onPauseCycle}
          accessibilityRole="button"
          accessibilityLabel={cycle.status === 'paused' ? 'Resume cycle' : 'Pause cycle'}
          style={{
            marginHorizontal: space.xl,
            marginTop: space.xl,
            padding: space.md,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: t.line,
            backgroundColor: t.surface,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: t.ink, fontSize: 14, fontFamily: font.sansSemi }}>
            {cycle.status === 'paused' ? 'Resume cycle' : 'Pause cycle'}
          </Text>
        </Pressable>
      ) : null}

      {/* End-cycle action (view mode, only for active or paused cycles) */}
      {!editing && (cycle.status === 'active' || cycle.status === 'paused') ? (
        <Pressable
          onPress={onEndCycle}
          accessibilityRole="button"
          accessibilityLabel="End cycle"
          style={{
            marginHorizontal: space.xl,
            marginTop: space.md,
            padding: space.md,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: t.danger,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: t.danger, fontSize: 14, fontFamily: font.sansSemi }}>
            End cycle
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
