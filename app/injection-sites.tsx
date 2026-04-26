// Injection sites — spec v2.0 §10 "Injection sites". Body map + rotation.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconClose } from '../components/Icons';
import { INJECTION_SITES, siteRecency, siteSuggestion, type SiteSuggestion } from '../lib/db';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, space } from '../theme/tokens';

const HUMAN_BODY_IMAGE = require('../assets/images/injection-human.png');
const BODY_MAP_ASPECT_RATIO = 1023 / 1537;

// (x, y) center for each zone as a percentage of the PNG canvas
const SITE_POSITIONS: Record<(typeof INJECTION_SITES)[number], [number, number]> = {
  'L.Deltoid': [33, 24],
  'R.Deltoid': [67, 24],
  'L.Abdomen': [45, 43],
  'R.Abdomen': [55, 43],
  'L.Hip': [43, 54],
  'R.Hip': [57, 54],
  'L.Thigh': [44, 70],
  'R.Thigh': [56, 70],
};

function zoneColor(days_since: number, suggested: boolean, t: any) {
  if (suggested) return t.accent;
  if (days_since < 3) return t.danger;
  if (days_since < 7) return t.warn;
  return t.success;
}

export default function InjectionSitesModal() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [recency, setRecency] = useState<SiteSuggestion[]>([]);
  const [suggestion, setSuggestion] = useState<SiteSuggestion | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([siteRecency(), siteSuggestion()]).then(([r, s]) => {
        setRecency(r);
        setSuggestion(s);
      });
    }, [])
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: insets.top + space.sm,
          paddingBottom: space.md,
          paddingHorizontal: space.xl,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <IconClose size={16} color={t.ink3} />
        </Pressable>
        <Text style={{ color: t.ink, fontSize: 15, fontFamily: font.sansSemi }}>
          Injection sites
        </Text>
        <View style={{ width: 16 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}>
        <View style={{ paddingHorizontal: space.xl }}>
          <Text
            style={{
              fontSize: 28,
              fontFamily: font.sansBold,
              color: t.ink,
              letterSpacing: -0.6,
              lineHeight: 32,
            }}
          >
            Rotate wisely.
          </Text>
          <Text style={{ color: t.ink3, fontSize: 14, marginTop: 4 }}>
            Regular rotation prevents lipodystrophy and scar tissue.
          </Text>
        </View>

        {/* Body map */}
        <View
          style={{
            marginHorizontal: space.xl,
            marginTop: space.xl,
            alignItems: 'center',
            backgroundColor: t.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: t.line,
            paddingVertical: space.lg,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 300,
              aspectRatio: BODY_MAP_ASPECT_RATIO,
              position: 'relative',
            }}
          >
            <Image
              source={HUMAN_BODY_IMAGE}
              resizeMode="contain"
              style={{ width: '100%', height: '100%' }}
            />
            {recency.map((r) => {
              const pos = SITE_POSITIONS[r.site as keyof typeof SITE_POSITIONS];
              if (!pos) return null;
              const suggested = r.site === suggestion?.site;
              const color = zoneColor(r.days_since, suggested, t);
              const dotSize = suggested ? 30 : 22;
              return (
                <View
                  key={r.site}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: `${pos[0]}%`,
                    top: `${pos[1]}%`,
                    width: dotSize,
                    height: dotSize,
                    marginLeft: -dotSize / 2,
                    marginTop: -dotSize / 2,
                    borderRadius: dotSize / 2,
                    backgroundColor: color,
                    opacity: suggested ? 0.95 : 0.75,
                    borderWidth: suggested ? 3 : 0,
                    borderColor: color,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {r.total_uses > 0 ? (
                    <Text style={{ color: '#fff', fontSize: 10, fontFamily: font.sansBold }}>
                      {r.total_uses}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>

          {/* Legend */}
          <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.md }}>
            <Legend color={t.accent} label="Next" />
            <Legend color={t.danger} label="<3d" />
            <Legend color={t.warn} label="3-7d" />
            <Legend color={t.success} label="Rested" />
          </View>
        </View>

        {/* Suggested */}
        {suggestion ? (
          <View style={{ paddingHorizontal: space.xl, marginTop: space.lg }}>
            <View
              style={{
                padding: space.md,
                borderRadius: radius.md,
                backgroundColor: t.accentSoft,
                borderLeftWidth: 3,
                borderLeftColor: t.accent,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: t.accentInk,
                  letterSpacing: 0.9,
                  fontFamily: font.sansSemi,
                  textTransform: 'uppercase',
                }}
              >
                Suggested next site
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 20,
                  fontFamily: font.sansBold,
                  color: t.ink,
                }}
              >
                {suggestion.site}
              </Text>
              <Text style={{ fontSize: 12, color: t.ink2, marginTop: 2 }}>
                {suggestion.days_since >= 999
                  ? 'Never used'
                  : `Last used ${suggestion.days_since}d ago`}
                {' · '}
                {suggestion.total_uses} total uses
              </Text>
            </View>
          </View>
        ) : null}

        {/* Full list */}
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
          All zones
        </Text>
        <Text style={{ paddingHorizontal: space.xl, marginTop: 4, fontSize: 11, color: t.ink4 }}>
          Tap a zone to log a dose there.
        </Text>
        <View style={{ paddingHorizontal: space.xl, marginTop: space.sm, gap: 6 }}>
          {recency.map((r) => (
            <Pressable
              key={r.site}
              onPress={() =>
                router.push({ pathname: '/log-dose', params: { site: r.site } } as any)
              }
              accessibilityRole="button"
              accessibilityLabel={`Log dose at ${r.site}`}
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
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: zoneColor(r.days_since, r.site === suggestion?.site, t),
                }}
              />
              <Text style={{ flex: 1, color: t.ink, fontSize: 14, fontFamily: font.sansSemi }}>
                {r.site}
              </Text>
              <Text style={{ color: t.ink3, fontSize: 12, fontFamily: font.mono }}>
                {r.days_since >= 999 ? '—' : `${r.days_since}d ago`}
              </Text>
              <Text style={{ color: t.ink3, fontSize: 12, fontFamily: font.mono, width: 40, textAlign: 'right' }}>
                {r.total_uses}×
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontSize: 10, color: t.ink3, fontFamily: font.sansMed }}>{label}</Text>
    </View>
  );
}
