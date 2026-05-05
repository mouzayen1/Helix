// Stack detail — editorial rebuild.
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { HairlineRow } from '../../components/editorial/HairlineRow';
import { useEditorialTheme } from '../../lib/design/theme';
import { DoseValue } from '../../components/editorial/DoseUnitChip';
import { deleteStack, getStack, type Stack, type StackItem } from '../../lib/db';
import { findPeptide } from '../../lib/peptides';

export default function StackDetail() {
  const ed = useEditorialTheme();
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
          backgroundColor: ed.colors.bg,
          paddingTop: insets.top + 24,
          paddingHorizontal: 24,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text
            style={{ fontFamily: ed.fraunces('Fraunces_300Light'), fontSize: 26, color: ed.colors.ink2 }}
          >
            ←
          </Text>
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
      style={{ flex: 1, backgroundColor: ed.colors.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 64 }}
    >
      <View
        style={{ paddingTop: insets.top + 12, paddingBottom: 12, paddingHorizontal: 24 }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
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
          Stack · {stack.goal ?? 'General'}
        </Text>
        <EditorialHeadline size="title1">{stack.name}</EditorialHeadline>
        {stack.synergy_score !== null ? (
          <Text
            style={{
              marginTop: 8,
              fontFamily: ed.typography.dataMd.fontFamily,
              fontSize: ed.typography.dataMd.fontSize,
              color: ed.colors.ink3,
            }}
          >
            Synergy {stack.synergy_score} / 100
          </Text>
        ) : null}
      </View>

      <View style={{ marginTop: 32, paddingHorizontal: 24 }}>
        {items.map((it, i) => {
          const p = findPeptide(it.peptide_id);
          return (
            <View key={i}>
              <Pressable
                onPress={() => p && router.push(`/peptide/${p.id}` as any)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 18,
                  gap: 14,
                }}
              >
                <View
                  style={{ width: 2, alignSelf: 'stretch', backgroundColor: p?.color ?? ed.colors.ink3 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: ed.fraunces('Fraunces_400Regular'),
                      fontSize: 19,
                      letterSpacing: -0.3,
                      color: ed.colors.ink1,
                    }}
                  >
                    {p?.name ?? it.peptide_id}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                    <DoseValue
                      mcg={it.dose_mcg}
                      valueStyle={{
                        fontFamily: ed.typography.labelSm.fontFamily,
                        fontSize: ed.typography.labelSm.fontSize,
                        letterSpacing: ed.typography.labelSm.letterSpacing,
                        color: ed.colors.ink3,
                        textTransform: 'uppercase',
                      }}
                    />
                    <Text
                      style={{
                        fontFamily: ed.typography.labelSm.fontFamily,
                        fontSize: ed.typography.labelSm.fontSize,
                        letterSpacing: ed.typography.labelSm.letterSpacing,
                        color: ed.colors.ink3,
                        textTransform: 'uppercase',
                      }}
                    >
                      · {it.freq} · {it.time}
                    </Text>
                  </View>
                </View>
                <Text
                  style={{
                    fontFamily: ed.fraunces('Fraunces_300Light'),
                    fontSize: 22,
                    color: ed.colors.ink3,
                  }}
                >
                  →
                </Text>
              </Pressable>
              {i < items.length - 1 ? <HairlineRow /> : null}
            </View>
          );
        })}
      </View>

      <View style={{ marginTop: 36, paddingHorizontal: 24 }}>
        <EditorialButton variant="secondary" fullWidth onPress={onDelete}>
          Delete stack
        </EditorialButton>
      </View>
    </ScrollView>
  );
}
