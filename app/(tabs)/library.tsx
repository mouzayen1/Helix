// Library (encyclopedia) — spec §10.2
// Search + category chips + featured card + peptide list.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line } from 'react-native-svg';
import { IconChevronRight, IconFilter, IconSearch } from '../../components/Icons';
import { HCard, HCodeAvatar, HSectionHeader, HTag } from '../../components/Primitives';
import { PEPTIDES, PEPTIDE_CLASSES } from '../../lib/peptides';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

export default function LibraryScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeCat, setActiveCat] = useState(0);

  const filteredPeptides =
    activeCat === 0
      ? PEPTIDES
      : PEPTIDES.filter((p) => p.class === PEPTIDE_CLASSES[activeCat]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: space.xl }}>
        <Text
          style={{
            fontSize: 32,
            fontFamily: font.sansBold,
            color: t.ink,
            letterSpacing: -0.8,
          }}
        >
          Library
        </Text>
        <Text style={{ fontSize: 14, color: t.ink3, marginTop: 2 }}>
          {PEPTIDES.length} peptides · research-grade data
        </Text>

        {/* Search */}
        <View
          style={{
            marginTop: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.line,
            borderRadius: radius.md,
            paddingHorizontal: 14,
            paddingVertical: 11,
          }}
        >
          <IconSearch size={16} color={t.ink3} />
          <Text style={{ fontSize: 14, color: t.ink3, flex: 1 }}>
            Search peptide, class, or effect
          </Text>
          <IconFilter size={14} color={t.ink3} />
        </View>
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space.xl, gap: 6, marginTop: 14 }}
        style={{ flexGrow: 0 }}
      >
        {PEPTIDE_CLASSES.map((c, i) => {
          const active = i === activeCat;
          return (
            <Pressable
              key={c}
              onPress={() => setActiveCat(i)}
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
                  fontSize: 13,
                  fontFamily: font.sansMed,
                  color: active ? t.bg : t.ink2,
                }}
              >
                {c}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Featured editorial card */}
      <HSectionHeader title="Featured" />
      <View style={{ paddingHorizontal: space.xl }}>
        <View
          style={{
            backgroundColor: t.surface,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: t.line,
            overflow: 'hidden',
          }}
        >
          <View style={{ height: 120, backgroundColor: t.accent, padding: 20 }}>
            <Text
              style={{
                color: '#fff',
                fontSize: 11,
                letterSpacing: 1.4,
                fontFamily: font.sansSemi,
                opacity: 0.85,
                textTransform: 'uppercase',
              }}
            >
              Beginner's guide
            </Text>
            <Text
              style={{
                color: '#fff',
                fontSize: 22,
                fontFamily: font.sansBold,
                marginTop: 6,
                letterSpacing: -0.3,
                maxWidth: 220,
                lineHeight: 26,
              }}
            >
              What actually is a peptide?
            </Text>

            <View style={{ position: 'absolute', right: 10, top: 10, opacity: 0.35 }}>
              <Svg width={100} height={100} viewBox="0 0 100 100">
                <Circle cx={30} cy={30} r={8} fill="#fff" />
                <Circle cx={70} cy={30} r={6} fill="#fff" />
                <Circle cx={55} cy={65} r={10} fill="#fff" />
                <Circle cx={80} cy={70} r={5} fill="#fff" />
                <Line x1={30} y1={30} x2={70} y2={30} stroke="#fff" strokeWidth={1.5} />
                <Line x1={30} y1={30} x2={55} y2={65} stroke="#fff" strokeWidth={1.5} />
                <Line x1={70} y1={30} x2={55} y2={65} stroke="#fff" strokeWidth={1.5} />
                <Line x1={55} y1={65} x2={80} y2={70} stroke="#fff" strokeWidth={1.5} />
              </Svg>
            </View>
          </View>
          <View style={{ padding: 16, paddingTop: 14 }}>
            <Text style={{ fontSize: 13, color: t.ink2, lineHeight: 19 }}>
              A short chain of amino acids. Smaller than a protein, bigger than a single amino
              acid — and that size is what lets them act as signals in the body.
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
              <HTag color={t.ink3}>5 min read</HTag>
              <HTag>Fundamentals</HTag>
            </View>
          </View>
        </View>
      </View>

      <HSectionHeader title="All peptides" action="Sort" />
      <View
        style={{
          paddingHorizontal: space.xl,
          gap: 8,
        }}
      >
        {filteredPeptides.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => router.push(`/peptide/${p.id}` as any)}
            style={{
              backgroundColor: t.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: t.line,
              paddingVertical: 14,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <HCodeAvatar id={p.name.split('-')[0]} color={p.color} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={{ fontSize: 15, fontFamily: font.sansSemi, color: t.ink }}>
                  {p.name}
                </Text>
                <Text style={{ fontSize: 11, color: t.ink3 }}>{p.class}</Text>
              </View>
              <Text
                style={{ fontSize: 12, color: t.ink3, marginTop: 2 }}
                numberOfLines={1}
              >
                {p.subtitle}
              </Text>
              <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
                {p.tags.slice(0, 2).map((tg) => (
                  <HTag key={tg} color={t.ink3}>
                    {tg}
                  </HTag>
                ))}
              </View>
            </View>
            <IconChevronRight size={14} color={t.ink4} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
