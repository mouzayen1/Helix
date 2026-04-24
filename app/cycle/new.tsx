// New cycle — spec v2.0 §10 "New cycle". Build a protocol and save.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronLeft, IconPlus } from '../../components/Icons';
import { createCycle, type CycleProtocolItem } from '../../lib/db';
import { PEPTIDES, findPeptide } from '../../lib/peptides';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

const TEMPLATES: Record<string, { name: string; peptides: { id: string; dose: number; freq: string }[]; weeks: number }> = {
  healing: {
    name: 'Healing stack',
    weeks: 6,
    peptides: [
      { id: 'bpc157', dose: 250, freq: 'twice daily' },
      { id: 'tb500', dose: 2500, freq: 'twice weekly' },
      { id: 'ghkcu', dose: 1000, freq: 'daily' },
    ],
  },
  gh_opt: {
    name: 'GH-optimization stack',
    weeks: 8,
    peptides: [
      { id: 'ipamor', dose: 250, freq: 'twice daily' },
      { id: 'cjc_nodac', dose: 100, freq: 'twice daily' },
    ],
  },
  fatloss: {
    name: 'Fat-loss stack',
    weeks: 12,
    peptides: [
      { id: 'sema', dose: 250, freq: 'weekly' },
      { id: 'aod', dose: 300, freq: 'daily' },
    ],
  },
};

const FREQUENCIES = ['daily', 'twice daily', 'every other day', 'twice weekly', 'weekly'];
const TIMES = ['morning', 'evening', 'pre-workout', 'pre-bed'];

export default function NewCycle() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { template } = useLocalSearchParams<{ template?: string }>();

  const tpl = template ? TEMPLATES[template] : null;

  const [name, setName] = useState(tpl?.name ?? '');
  const [durationWeeks, setDurationWeeks] = useState(tpl?.weeks ?? 4);
  const [phase, setPhase] = useState<'loading' | 'active' | 'taper' | 'washout'>('active');
  const [items, setItems] = useState<CycleProtocolItem[]>(
    tpl?.peptides.map((p) => ({
      peptide_id: p.id,
      dose_mcg: p.dose,
      freq: p.freq,
      time_of_day: 'morning',
    })) ?? []
  );
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const startsOn = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const endsOn = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + durationWeeks * 7);
    return d.toISOString().slice(0, 10);
  }, [durationWeeks]);

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

  const updateItem = (i: number, patch: Partial<CycleProtocolItem>) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };

  const removeItem = (i: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  };

  const save = async () => {
    if (!name.trim() || items.length === 0 || saving) return;
    setSaving(true);
    try {
      await createCycle({
        name: name.trim(),
        starts_on: startsOn,
        ends_on: endsOn,
        phase,
        protocol: items,
      });
      router.replace('/(tabs)/stacks');
    } catch (e) {
      console.warn('create cycle failed', e);
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Top bar */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: insets.top + space.sm,
          paddingBottom: space.md,
          paddingHorizontal: space.xl,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <IconChevronLeft size={18} color={t.ink2} />
        </Pressable>
        <Text style={{ fontSize: 15, fontFamily: font.sansSemi, color: t.ink }}>New cycle</Text>
        <Pressable
          onPress={save}
          disabled={saving || !name.trim() || items.length === 0}
          hitSlop={10}
        >
          <Text
            style={{
              color: saving || !name.trim() || items.length === 0 ? t.ink3 : t.accent,
              fontSize: 14,
              fontFamily: font.sansSemi,
            }}
          >
            Save
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name */}
        <View style={{ gap: 6 }}>
          <Text
            style={{
              fontSize: 11,
              color: t.ink3,
              letterSpacing: 0.9,
              fontFamily: font.sansSemi,
              textTransform: 'uppercase',
            }}
          >
            Cycle name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="My cycle"
            placeholderTextColor={t.ink4}
            style={{
              backgroundColor: t.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.line,
              padding: space.md,
              color: t.ink,
              fontSize: 15,
              fontFamily: font.sansMed,
            }}
          />
        </View>

        {/* Duration + phase */}
        <View style={{ flexDirection: 'column', gap: 12, marginTop: space.md }}>
          <View style={{ flex: 1 }}>
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
              Duration (weeks)
            </Text>
            <View
              style={{
                backgroundColor: t.surface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: t.line,
                padding: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
              }}
            >
              <Pressable
                onPress={() => setDurationWeeks((v) => Math.max(1, v - 1))}
                style={{ padding: 4 }}
                hitSlop={6}
              >
                <Text style={{ fontSize: 18, fontFamily: font.sansSemi, color: t.ink }}>−</Text>
              </Pressable>
              <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontFamily: font.monoSemi, color: t.ink }}>
                {durationWeeks} wk
              </Text>
              <Pressable
                onPress={() => setDurationWeeks((v) => Math.min(52, v + 1))}
                style={{ padding: 4 }}
                hitSlop={6}
              >
                <Text style={{ fontSize: 18, fontFamily: font.sansSemi, color: t.ink }}>+</Text>
              </Pressable>
            </View>
          </View>
          <View style={{ flex: 1 }}>
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
            <View style={{ gap: 6 }}>
              {(
                [
                  { id: 'loading' as const, label: 'Loading', desc: 'Ramp-up phase' },
                  { id: 'active' as const, label: 'Active', desc: 'Main protocol' },
                  { id: 'taper' as const, label: 'Taper', desc: 'Wind-down' },
                  { id: 'washout' as const, label: 'Washout', desc: 'Rest between cycles' },
                ]
              ).map((ph) => {
                const active = ph.id === phase;
                return (
                  <Pressable
                    key={ph.id}
                    onPress={() => setPhase(ph.id)}
                    style={{
                      padding: 10,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: active ? t.accent : t.line,
                      backgroundColor: active ? t.accentSoft : t.surface,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: active ? t.accent : t.ink4,
                        backgroundColor: active ? t.accent : 'transparent',
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: active ? font.sansSemi : font.sansMed,
                          color: active ? t.ink : t.ink2,
                        }}
                      >
                        {ph.label}
                      </Text>
                      <Text style={{ fontSize: 11, color: t.ink3, marginTop: 1 }}>
                        {ph.desc}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <Text style={{ marginTop: 6, fontSize: 11, color: t.ink3, fontFamily: font.mono }}>
          {startsOn} → {endsOn}
        </Text>

        {/* Protocol */}
        <View
          style={{
            marginTop: space.xl,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: t.ink3,
              letterSpacing: 0.9,
              fontFamily: font.sansSemi,
              textTransform: 'uppercase',
            }}
          >
            Protocol ({items.length})
          </Text>
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
        </View>

        {showPicker ? (
          <View
            style={{
              marginTop: 8,
              maxHeight: 240,
              backgroundColor: t.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.line,
            }}
          >
            <ScrollView>
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
                  <Text style={{ color: t.ink3, fontSize: 11 }}>{p.class.split('/')[0]}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={{ gap: 8, marginTop: space.md }}>
          {items.map((it, i) => {
            const p = findPeptide(it.peptide_id);
            return (
              <View
                key={i}
                style={{
                  backgroundColor: t.surface,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: t.line,
                  padding: space.md,
                  gap: space.sm,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
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
                    {p?.name ?? it.peptide_id}
                  </Text>
                  <Pressable onPress={() => removeItem(i)} hitSlop={8}>
                    <Text style={{ color: t.danger, fontSize: 12, fontFamily: font.sansSemi }}>
                      Remove
                    </Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 10,
                        color: t.ink3,
                        fontFamily: font.sansSemi,
                        letterSpacing: 0.5,
                        marginBottom: 3,
                        textTransform: 'uppercase',
                      }}
                    >
                      Dose (mcg)
                    </Text>
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
                        onPress={() => updateItem(i, { dose_mcg: Math.max(1, it.dose_mcg - 25) })}
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
                        {it.dose_mcg}
                      </Text>
                      <Pressable
                        onPress={() => updateItem(i, { dose_mcg: it.dose_mcg + 25 })}
                        hitSlop={6}
                      >
                        <Text style={{ fontSize: 16, color: t.ink, paddingHorizontal: 6 }}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
                <View>
                  <Text
                    style={{
                      fontSize: 10,
                      color: t.ink3,
                      fontFamily: font.sansSemi,
                      letterSpacing: 0.5,
                      marginBottom: 6,
                      textTransform: 'uppercase',
                    }}
                  >
                    Frequency
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                    {FREQUENCIES.map((f) => {
                      const active = f === it.freq;
                      return (
                        <Pressable
                          key={f}
                          onPress={() => updateItem(i, { freq: f })}
                          style={{
                            paddingVertical: 5,
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
                </View>
                <View>
                  <Text
                    style={{
                      fontSize: 10,
                      color: t.ink3,
                      fontFamily: font.sansSemi,
                      letterSpacing: 0.5,
                      marginBottom: 6,
                      textTransform: 'uppercase',
                    }}
                  >
                    Time of day
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {TIMES.map((tod) => {
                      const active = tod === it.time_of_day;
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
                </View>
              </View>
            );
          })}
        </View>

        {items.length === 0 ? (
          <View
            style={{
              marginTop: space.md,
              padding: space.lg,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.line,
              borderStyle: 'dashed',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: t.ink3, fontSize: 13 }}>
              Add a peptide to start building your protocol.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
