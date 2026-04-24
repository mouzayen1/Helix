// Cycle detail — spec v2.0 §10. View + edit mode.
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronLeft, IconPlus } from '../../components/Icons';
import { endCycle, listCycles, updateCycle, type Cycle } from '../../lib/db';
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
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const all = await listCycles();
    const c = all.find((x) => x.id === id) ?? null;
    setCycle(c);
    if (c) {
      setName(c.name);
      setPhase(c.phase);
      setStatus(c.status);
      try {
        setItems(JSON.parse(c.protocol_json || '[]'));
      } catch {
        setItems([]);
      }
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

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

  const start = new Date(cycle.starts_on);
  const end = new Date(cycle.ends_on);
  const today = new Date();
  const total = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 864e5));
  const day = Math.min(
    total,
    Math.max(0, Math.floor((today.getTime() - start.getTime()) / 864e5))
  );
  const pct = Math.round((day / total) * 100);

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateCycle(cycle.id, {
        name: name.trim() || cycle.name,
        phase,
        status,
        protocol: items,
      });
      setEditing(false);
      refresh();
    } catch (e) {
      console.warn('update cycle failed', e);
    } finally {
      setSaving(false);
    }
  };

  const onEndCycle = async () => {
    await endCycle(cycle.id);
    router.back();
  };

  const addPeptide = (pid: string) => {
    const p = findPeptide(pid)!;
    const defaultDose = parseInt(p.dose?.match(/(\d+)/)?.[1] ?? '250', 10);
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
        <Pressable onPress={() => (editing ? setEditing(false) : router.back())} hitSlop={8}>
          <IconChevronLeft size={18} color={t.ink2} />
        </Pressable>
        {editing ? (
          <Pressable onPress={onSave} disabled={saving}>
            <Text style={{ color: saving ? t.ink3 : t.accent, fontSize: 14, fontFamily: font.sansSemi }}>
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
                      onPress={() => updateItem(i, { dose_mcg: Math.max(1, row.dose_mcg - 25) })}
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
                      onPress={() => updateItem(i, { dose_mcg: row.dose_mcg + 25 })}
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

      {/* End-cycle action (view mode, only for active cycles) */}
      {!editing && cycle.status === 'active' ? (
        <Pressable
          onPress={onEndCycle}
          style={{
            marginHorizontal: space.xl,
            marginTop: space.xl,
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
