// Peptide detail — spec §10.3
// Hero, summary, tabs, key facts grid, mechanism, stacks, CTAs.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronLeft } from '../../components/Icons';
import { HFormula, HSectionHeader } from '../../components/Primitives';
import { findPeptide } from '../../lib/peptides';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

const MECHANISM = [
  {
    n: '1',
    title: 'Upregulates growth factors',
    body: 'Stimulates VEGF and FGF-2 pathways involved in angiogenesis and tissue repair.',
  },
  {
    n: '2',
    title: 'Supports collagen synthesis',
    body: 'Increases fibroblast migration to damaged tissue, accelerating rebuild phase.',
  },
  {
    n: '3',
    title: 'GI tract integrity',
    body: 'Shown in rodent studies to protect gastric lining and reduce inflammation.',
  },
];

const TABS = ['Overview', 'Dosing', 'Research', 'Stack'];

export default function PeptideDetailScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = findPeptide(id) ?? findPeptide('bpc157')!;

  const facts = [
    { label: 'Typical dose', val: p.dosing.typical },
    { label: 'Frequency', val: p.dosing.freq },
    { label: 'Route', val: p.dosing.route },
    { label: 'Half-life', val: p.halfLife },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View
        style={{
          backgroundColor: p.color + '22',
          paddingTop: insets.top + 8,
          paddingBottom: 20,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: space.xl,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: t.surface,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: t.line,
            }}
            hitSlop={8}
          >
            <IconChevronLeft size={16} color={t.ink2} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: space.xl, paddingTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Text
              style={{
                fontSize: 11,
                fontFamily: font.sansBold,
                letterSpacing: 1.2,
                color: p.color,
                textTransform: 'uppercase',
              }}
            >
              {p.class}
            </Text>
            <Text style={{ color: t.ink4 }}>·</Text>
            <Text style={{ fontSize: 11, color: t.ink3, fontFamily: font.mono }}>
              t½ {p.halfLife}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 40,
              fontFamily: font.sansBold,
              color: t.ink,
              letterSpacing: -1,
              lineHeight: 44,
            }}
          >
            {p.name}
          </Text>
          <Text style={{ fontSize: 15, color: t.ink2, marginTop: 6 }}>{p.subtitle}</Text>
          <View style={{ marginTop: 12 }}>
            <HFormula formula={p.formula} mw={p.mw} />
          </View>
        </View>
      </View>

      {/* Summary */}
      <View style={{ paddingHorizontal: space.xl, marginTop: 20 }}>
        <Text style={{ fontSize: 15, color: t.ink2, lineHeight: 23 }}>{p.summary}</Text>
      </View>

      {/* Research warning */}
      <View style={{ paddingHorizontal: space.xl, marginTop: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 12,
            backgroundColor: t.warnSoft + '80',
            borderWidth: 1,
            borderColor: t.warn + '40',
          }}
        >
          <Text style={{ fontSize: 12, color: t.ink2, lineHeight: 17, flex: 1 }}>
            Research chemical. Not FDA-approved for human use. Info for educational purposes only.
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View
        style={{
          flexDirection: 'row',
          gap: 20,
          paddingHorizontal: space.xl,
          marginTop: 24,
          borderBottomWidth: 1,
          borderBottomColor: t.line,
        }}
      >
        {TABS.map((tab, i) => (
          <View
            key={tab}
            style={{
              paddingVertical: 10,
              borderBottomWidth: 2,
              borderBottomColor: i === 0 ? t.ink : 'transparent',
              marginBottom: -1,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: i === 0 ? font.sansSemi : font.sansMed,
                color: i === 0 ? t.ink : t.ink3,
              }}
            >
              {tab}
            </Text>
          </View>
        ))}
      </View>

      {/* Key facts grid */}
      <View
        style={{
          paddingHorizontal: space.xl,
          paddingTop: 20,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        {facts.map((f) => (
          <View
            key={f.label}
            style={{
              width: '48.5%',
              backgroundColor: t.surface,
              borderRadius: radius.md,
              padding: 14,
              borderWidth: 1,
              borderColor: t.line,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                letterSpacing: 1.1,
                color: t.ink3,
                fontFamily: font.sansSemi,
                textTransform: 'uppercase',
              }}
            >
              {f.label}
            </Text>
            <Text
              style={{
                fontSize: 16,
                fontFamily: font.monoSemi,
                color: t.ink,
                marginTop: 6,
                letterSpacing: -0.2,
              }}
            >
              {f.val}
            </Text>
          </View>
        ))}
      </View>

      {/* Mechanism */}
      <View style={{ paddingHorizontal: space.xl, marginTop: 20 }}>
        <Text
          style={{
            fontSize: 11,
            fontFamily: font.sansSemi,
            letterSpacing: 1.2,
            color: t.ink3,
            marginBottom: 10,
            textTransform: 'uppercase',
          }}
        >
          Mechanism
        </Text>
        <View
          style={{
            backgroundColor: t.surface,
            borderRadius: radius.lg,
            padding: 16,
            borderWidth: 1,
            borderColor: t.line,
          }}
        >
          {MECHANISM.map((m, i) => (
            <View
              key={m.n}
              style={{
                flexDirection: 'row',
                gap: 12,
                paddingVertical: 12,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: t.line,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: p.color + '22',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: font.monoSemi,
                    color: p.color,
                  }}
                >
                  {m.n}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: font.sansSemi, color: t.ink }}>
                  {m.title}
                </Text>
                <Text
                  style={{ fontSize: 12, color: t.ink3, marginTop: 3, lineHeight: 18 }}
                >
                  {m.body}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Stacks */}
      <HSectionHeader title="Pairs well with" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space.xl, gap: 8 }}
      >
        {p.stacks.map((s) => (
          <View
            key={s}
            style={{
              backgroundColor: t.surface,
              borderRadius: radius.md,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderWidth: 1,
              borderColor: t.line,
              minWidth: 130,
            }}
          >
            <Text style={{ fontSize: 14, fontFamily: font.sansSemi, color: t.ink }}>{s}</Text>
            <Text style={{ fontSize: 11, color: t.ink3, marginTop: 3 }}>Synergistic</Text>
          </View>
        ))}
      </ScrollView>

      {/* CTAs */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: space.xl,
          paddingTop: 24,
          gap: 10,
        }}
      >
        <Pressable
          onPress={() => router.push('/log-dose')}
          style={{
            flex: 1,
            padding: 14,
            borderRadius: radius.md,
            backgroundColor: t.ink,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 15, fontFamily: font.sansSemi, color: t.bg }}>
            Add to protocol
          </Text>
        </Pressable>
        <Pressable
          style={{
            paddingVertical: 14,
            paddingHorizontal: 18,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: t.lineStrong,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 15, fontFamily: font.sansSemi, color: t.ink }}>Save</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
