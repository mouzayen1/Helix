// Cycle detail — spec v2.0 §10.
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronLeft } from '../../components/Icons';
import { endCycle, listCycles, type Cycle } from '../../lib/db';
import { findPeptide } from '../../lib/peptides';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

export default function CycleDetail() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [cycle, setCycle] = useState<Cycle | null>(null);

  const refresh = useCallback(async () => {
    const all = await listCycles();
    setCycle(all.find((c) => c.id === id) ?? null);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  if (!cycle) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + space.lg, paddingHorizontal: space.xl }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconChevronLeft size={18} color={t.ink2} />
        </Pressable>
        <Text style={{ marginTop: space.xl, color: t.ink3 }}>Loading…</Text>
      </View>
    );
  }

  const protocol = JSON.parse(cycle.protocol_json || '[]') as {
    peptide_id: string;
    dose_mcg: number;
    freq: string;
    time_of_day: string;
  }[];
  const start = new Date(cycle.starts_on);
  const end = new Date(cycle.ends_on);
  const today = new Date();
  const total = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 864e5));
  const day = Math.min(
    total,
    Math.max(0, Math.floor((today.getTime() - start.getTime()) / 864e5))
  );
  const pct = Math.round((day / total) * 100);

  const onEndCycle = async () => {
    await endCycle(cycle.id);
    router.back();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
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
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconChevronLeft size={18} color={t.ink2} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: space.xl }}>
        <Text style={{ color: t.accent, fontSize: 11, fontFamily: font.sansSemi, letterSpacing: 1.2, textTransform: 'uppercase' }}>
          {cycle.status} · {cycle.phase}
        </Text>
        <Text
          style={{
            fontSize: 28,
            fontFamily: font.sansBold,
            color: t.ink,
            letterSpacing: -0.6,
            marginTop: 4,
          }}
        >
          {cycle.name}
        </Text>
        <Text style={{ color: t.ink3, fontSize: 13, fontFamily: font.mono, marginTop: 2 }}>
          {cycle.starts_on} → {cycle.ends_on}
        </Text>
      </View>

      {/* Progress */}
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

      {/* Protocol */}
      <Text
        style={{
          marginTop: space.xl,
          paddingHorizontal: space.xl,
          fontSize: 11,
          letterSpacing: 1.2,
          fontFamily: font.sansSemi,
          textTransform: 'uppercase',
          color: t.ink3,
        }}
      >
        Protocol
      </Text>
      <View style={{ paddingHorizontal: space.xl, marginTop: space.sm, gap: 8 }}>
        {protocol.map((row, i) => {
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
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 4,
                  alignSelf: 'stretch',
                  borderRadius: 2,
                  backgroundColor: p?.color ?? t.ink3,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.ink, fontSize: 15, fontFamily: font.sansSemi }}>
                  {p?.name ?? row.peptide_id}
                </Text>
                <Text style={{ color: t.ink3, fontSize: 12, fontFamily: font.mono, marginTop: 2 }}>
                  {row.dose_mcg} mcg · {row.freq} · {row.time_of_day}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Actions */}
      {cycle.status === 'active' ? (
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
