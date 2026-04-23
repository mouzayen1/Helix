// New stack — a named grouping of peptides. Spec v2.0 §10 "Stacks".
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronLeft, IconPlus } from '../../components/Icons';
import { createStack, type StackItem } from '../../lib/db';
import { PEPTIDES, findPeptide } from '../../lib/peptides';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

const GOALS = ['Healing', 'Growth', 'Fat-loss', 'Cognitive', 'Longevity'];

export default function NewStack() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [goal, setGoal] = useState<string>('Healing');
  const [items, setItems] = useState<StackItem[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const addPeptide = (pid: string) => {
    const p = findPeptide(pid)!;
    const defaultDose = parseInt(p.dose?.match(/(\d+)/)?.[1] ?? '250', 10);
    setItems((prev) => [
      ...prev,
      { peptide_id: pid, dose_mcg: defaultDose, unit: 'mcg', freq: 'daily', time: 'morning' },
    ]);
    setShowPicker(false);
  };

  const removeItem = (i: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  };

  // Simple synergy heuristic: +20 per peptide that has this stack's members listed in its `stacks` field
  const synergy = (() => {
    if (items.length < 2) return 0;
    let pts = 0;
    for (const it of items) {
      const p = findPeptide(it.peptide_id);
      if (!p) continue;
      for (const other of items) {
        if (other === it) continue;
        const otherP = findPeptide(other.peptide_id);
        if (!otherP) continue;
        if (p.stacks.some((s) => s.toLowerCase().includes(otherP.name.toLowerCase().split(' ')[0]))) {
          pts += 20;
        }
      }
    }
    return Math.min(100, pts);
  })();

  const save = async () => {
    if (!name.trim() || items.length === 0 || saving) return;
    setSaving(true);
    try {
      await createStack({
        name: name.trim(),
        goal,
        items,
        synergy_score: synergy,
      });
      router.replace('/(tabs)/stacks');
    } catch (e) {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
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
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconChevronLeft size={18} color={t.ink2} />
        </Pressable>
        <Text style={{ color: t.ink, fontSize: 15, fontFamily: font.sansSemi }}>New stack</Text>
        <Pressable
          onPress={save}
          disabled={saving || !name.trim() || items.length === 0}
          hitSlop={8}
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
        <Text
          style={{
            fontSize: 11,
            color: t.ink3,
            letterSpacing: 0.9,
            fontFamily: font.sansSemi,
            textTransform: 'uppercase',
          }}
        >
          Stack name
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="My healing stack"
          placeholderTextColor={t.ink4}
          style={{
            marginTop: 6,
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

        <Text
          style={{
            marginTop: space.md,
            fontSize: 11,
            color: t.ink3,
            letterSpacing: 0.9,
            fontFamily: font.sansSemi,
            textTransform: 'uppercase',
          }}
        >
          Goal
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {GOALS.map((g) => {
            const active = g === goal;
            return (
              <Pressable
                key={g}
                onPress={() => setGoal(g)}
                style={{
                  paddingVertical: 7,
                  paddingHorizontal: 13,
                  borderRadius: radius.pill,
                  backgroundColor: active ? t.ink : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? t.ink : t.line,
                }}
              >
                <Text style={{ color: active ? t.bg : t.ink2, fontSize: 12, fontFamily: font.sansMed }}>
                  {g}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Synergy */}
        {items.length >= 2 ? (
          <View
            style={{
              marginTop: space.xl,
              padding: space.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.line,
              backgroundColor: t.surface,
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
              Synergy
            </Text>
            <Text style={{ fontSize: 24, fontFamily: font.monoSemi, color: t.ink, marginTop: 4 }}>
              {synergy}
              <Text style={{ fontSize: 14, color: t.ink3 }}> / 100</Text>
            </Text>
            <View style={{ height: 4, backgroundColor: t.surfaceAlt, borderRadius: 2, marginTop: 8 }}>
              <View
                style={{
                  width: `${synergy}%`,
                  height: 4,
                  backgroundColor: synergy > 40 ? t.accent : t.warn,
                  borderRadius: 2,
                }}
              />
            </View>
            <Text style={{ fontSize: 11, color: t.ink3, marginTop: 6 }}>
              Based on stack partnerships listed in each peptide's monograph.
            </Text>
          </View>
        ) : null}

        {/* Items */}
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
            Peptides ({items.length})
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
            <Text style={{ color: t.ink2, fontSize: 12, fontFamily: font.sansMed }}>Add</Text>
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
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={{ gap: 8, marginTop: space.sm }}>
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
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.ink, fontSize: 14, fontFamily: font.sansSemi }}>
                    {p?.name ?? it.peptide_id}
                  </Text>
                  <Text style={{ color: t.ink3, fontSize: 11, fontFamily: font.mono, marginTop: 2 }}>
                    {it.dose_mcg} mcg · {it.freq}
                  </Text>
                </View>
                <Pressable onPress={() => removeItem(i)} hitSlop={6}>
                  <Text style={{ color: t.danger, fontSize: 12, fontFamily: font.sansSemi }}>
                    Remove
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
