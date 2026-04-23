// Stack detail — spec v2.0 §10.
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronLeft } from '../../components/Icons';
import { deleteStack, getStack, type Stack, type StackItem } from '../../lib/db';
import { findPeptide } from '../../lib/peptides';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

export default function StackDetail() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [stack, setStack] = useState<Stack | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (id) getStack(id).then(setStack);
    }, [id])
  );

  if (!stack) {
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
      </View>
    );
  }

  const items = JSON.parse(stack.items_json) as StackItem[];

  const onDelete = async () => {
    await deleteStack(stack.id);
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
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconChevronLeft size={18} color={t.ink2} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: space.xl }}>
        <Text
          style={{
            fontSize: 11,
            color: t.accent,
            letterSpacing: 1.2,
            fontFamily: font.sansSemi,
            textTransform: 'uppercase',
          }}
        >
          Stack · {stack.goal ?? 'General'}
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
          {stack.name}
        </Text>
        {stack.synergy_score !== null ? (
          <Text style={{ color: t.ink3, fontSize: 13, fontFamily: font.mono, marginTop: 2 }}>
            Synergy {stack.synergy_score} / 100
          </Text>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: space.xl, marginTop: space.xl, gap: 8 }}>
        {items.map((it, i) => {
          const p = findPeptide(it.peptide_id);
          return (
            <Pressable
              key={i}
              onPress={() => p && router.push(`/peptide/${p.id}` as any)}
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
                  {p?.name ?? it.peptide_id}
                </Text>
                <Text style={{ color: t.ink3, fontSize: 12, fontFamily: font.mono, marginTop: 2 }}>
                  {it.dose_mcg} {it.unit} · {it.freq} · {it.time}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={onDelete}
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
          Delete stack
        </Text>
      </Pressable>
    </ScrollView>
  );
}
