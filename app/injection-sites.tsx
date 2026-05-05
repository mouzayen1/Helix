// Injection sites — interactive body map with rotation history.
//
// Two-way design:
//   • OUTPUT — heatmap of recent injections, recolored live as the user
//     toggles the time threshold (24h / 3d / 7d / 14d).
//   • INSPECT — single-tap a zone (or its row in the All-zones list) to
//     open a bottom sheet showing recent doses at that site, stats when
//     n ≥ 3, and a 'Log dose here' CTA that routes to /log-dose with the
//     site pre-selected. Single-tap was chosen over long-press
//     intentionally: long-press has near-zero discoverability on mobile
//     and competes with system gestures. One gesture, one mental model.
//
// PNG-overlay layout: the body image is rendered with `resizeMode='contain'`
// inside an aspectRatio-locked View; zone dots are absolutely positioned
// as percentages of that view so they stay glued to the right anatomical
// spot at any width.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconClose } from '../components/Icons';
import {
  INJECTION_SITES,
  listDosesAtSite,
  siteRecency,
  siteSuggestion,
  type Dose,
  type SiteSuggestion,
} from '../lib/db';
import { findPeptide } from '../lib/peptides';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, space } from '../theme/tokens';

const HUMAN_BODY_IMAGE = require('../assets/images/injection-human.png');
const BODY_MAP_ASPECT_RATIO = 1023 / 1537;

// (x, y) center for each zone as a percentage of the PNG canvas.
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

// User-chosen rotation discipline — sets where the "too recent" threshold
// lives in the heatmap. 7d is the default because it matches the original
// rotation guidance ("don't repeat the same site within a week").
type Threshold = '24h' | '3d' | '7d' | '14d';
const THRESHOLDS: { key: Threshold; label: string; days: number }[] = [
  { key: '24h', label: '24h', days: 1 },
  { key: '3d', label: '3d', days: 3 },
  { key: '7d', label: '7d', days: 7 },
  { key: '14d', label: '14d', days: 14 },
];

function zoneColor(daysSince: number, suggested: boolean, thresholdDays: number, t: any) {
  if (suggested) return t.accent;
  if (daysSince < thresholdDays / 3) return t.danger;
  if (daysSince < thresholdDays) return t.warn;
  return t.success;
}

export default function InjectionSitesModal() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [recency, setRecency] = useState<SiteSuggestion[]>([]);
  const [suggestion, setSuggestion] = useState<SiteSuggestion | null>(null);
  const [threshold, setThreshold] = useState<Threshold>('7d');
  const [activeSite, setActiveSite] = useState<string | null>(null);
  const [siteDoses, setSiteDoses] = useState<Dose[]>([]);
  const [siteDosesLoading, setSiteDosesLoading] = useState(false);

  const thresholdDays = useMemo(
    () => THRESHOLDS.find((th) => th.key === threshold)?.days ?? 7,
    [threshold]
  );

  useFocusEffect(
    useCallback(() => {
      Promise.all([siteRecency(), siteSuggestion()]).then(([r, s]) => {
        setRecency(r);
        setSuggestion(s);
      });
    }, [])
  );

  const openSite = async (site: string) => {
    setActiveSite(site);
    setSiteDosesLoading(true);
    try {
      const ds = await listDosesAtSite(site, 10);
      setSiteDoses(ds);
    } finally {
      setSiteDosesLoading(false);
    }
  };
  const closeSite = () => {
    setActiveSite(null);
    setSiteDoses([]);
  };

  // Stats for the open site. Only computed (and rendered) at n ≥ 3 — a
  // 2-point sample produces a noisy 'average' that misleads more than it
  // informs.
  const siteRecencyEntry = useMemo(
    () => recency.find((r) => r.site === activeSite) ?? null,
    [recency, activeSite]
  );
  const siteStats = useMemo(() => {
    if (siteDoses.length < 3) return null;
    const sortedTimes = siteDoses
      .map((d) => new Date(d.taken_at).getTime())
      .sort((a, b) => a - b);
    let sumGaps = 0;
    for (let i = 1; i < sortedTimes.length; i++) sumGaps += sortedTimes[i] - sortedTimes[i - 1];
    const avgDaysBetween = sumGaps / (sortedTimes.length - 1) / 864e5;
    return {
      avgDaysBetween: avgDaysBetween.toFixed(avgDaysBetween < 10 ? 1 : 0),
    };
  }, [siteDoses]);

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
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close">
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
            Tap a zone to see its history. Adjust the threshold below to match your rotation.
          </Text>
        </View>

        {/* Threshold chips — controls heatmap shading + 'too recent'
            classification. */}
        <View
          style={{
            paddingHorizontal: space.xl,
            marginTop: space.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              letterSpacing: 0.8,
              color: t.ink3,
              fontFamily: font.sansSemi,
              textTransform: 'uppercase',
              marginRight: 4,
            }}
          >
            Threshold
          </Text>
          {THRESHOLDS.map((th) => {
            const active = th.key === threshold;
            return (
              <Pressable
                key={th.key}
                onPress={() => setThreshold(th.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Rotation threshold ${th.label}`}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
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
                  }}
                >
                  {th.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Body map */}
        <View
          style={{
            marginHorizontal: space.xl,
            marginTop: space.lg,
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
              const color = zoneColor(r.days_since, suggested, thresholdDays, t);
              const dotSize = suggested ? 32 : 26; // bigger than v1.1.6 — better tap target
              return (
                <Pressable
                  key={r.site}
                  onPress={() => openSite(r.site)}
                  accessibilityRole="button"
                  accessibilityLabel={`Inspect ${r.site}`}
                  hitSlop={8}
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
                    opacity: suggested ? 0.95 : 0.8,
                    borderWidth: suggested ? 3 : 0,
                    borderColor: color,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {r.total_uses > 0 ? (
                    <Text style={{ color: '#fff', fontSize: 11, fontFamily: font.sansBold }}>
                      {r.total_uses}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {/* Legend — labels track the active threshold */}
          <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.md, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Legend color={t.accent} label="Next" />
            <Legend color={t.danger} label={`<${Math.max(1, Math.round(thresholdDays / 3))}d`} />
            <Legend color={t.warn} label={`<${thresholdDays}d`} />
            <Legend color={t.success} label="Rested" />
          </View>
        </View>

        {/* Suggested-next callout */}
        {suggestion ? (
          <Pressable
            onPress={() => openSite(suggestion.site)}
            accessibilityRole="button"
            accessibilityLabel={`Inspect suggested next site ${suggestion.site}`}
            style={{ paddingHorizontal: space.xl, marginTop: space.lg }}
          >
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
          </Pressable>
        ) : null}

        {/* All zones — secondary list, mirrors the body-map dots */}
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
          Tap a zone for history and to log there.
        </Text>
        <View style={{ paddingHorizontal: space.xl, marginTop: space.sm, gap: 6 }}>
          {recency.map((r) => (
            <Pressable
              key={r.site}
              onPress={() => openSite(r.site)}
              accessibilityRole="button"
              accessibilityLabel={`Inspect ${r.site}`}
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
                  backgroundColor: zoneColor(
                    r.days_since,
                    r.site === suggestion?.site,
                    thresholdDays,
                    t
                  ),
                }}
              />
              <Text style={{ flex: 1, color: t.ink, fontSize: 14, fontFamily: font.sansSemi }}>
                {r.site}
              </Text>
              <Text style={{ color: t.ink3, fontSize: 12, fontFamily: font.mono }}>
                {r.days_since >= 999 ? '—' : `${r.days_since}d ago`}
              </Text>
              <Text
                style={{
                  color: t.ink3,
                  fontSize: 12,
                  fontFamily: font.mono,
                  width: 40,
                  textAlign: 'right',
                }}
              >
                {r.total_uses}×
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Site-detail bottom sheet — opens when a body-map dot or list row
          is tapped. Shows last-used + recent doses + (optional) stats +
          a 'Log dose here' CTA that routes back to /log-dose with the
          site pre-selected. */}
      <Modal
        visible={!!activeSite}
        transparent
        animationType="fade"
        onRequestClose={closeSite}
      >
        <Pressable
          onPress={closeSite}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: t.surface,
              paddingTop: space.lg,
              paddingBottom: insets.bottom + space.lg,
              paddingHorizontal: space.xl,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              gap: space.md,
              maxHeight: '80%',
            }}
          >
            {activeSite ? (
              <>
                <View>
                  <Text style={{ fontSize: 18, fontFamily: font.sansBold, color: t.ink }}>
                    {activeSite}
                  </Text>
                  <Text
                    style={{ fontSize: 12, color: t.ink3, fontFamily: font.mono, marginTop: 2 }}
                  >
                    {siteRecencyEntry && siteRecencyEntry.days_since < 999
                      ? `Last used ${siteRecencyEntry.days_since}d ago · ${siteRecencyEntry.total_uses} total ${siteRecencyEntry.total_uses === 1 ? 'use' : 'uses'}`
                      : 'Never used'}
                    {siteStats ? ` · ~${siteStats.avgDaysBetween}d between uses` : ''}
                  </Text>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: 280 }}
                  contentContainerStyle={{ gap: 6 }}
                >
                  {siteDosesLoading ? (
                    <Text style={{ color: t.ink3, fontSize: 13 }}>Loading…</Text>
                  ) : siteDoses.length === 0 ? (
                    <Text style={{ color: t.ink3, fontSize: 13 }}>
                      No doses logged at this site yet.
                    </Text>
                  ) : (
                    siteDoses.map((d) => {
                      const p = findPeptide(d.peptide_id);
                      const when = new Date(d.taken_at);
                      return (
                        <View
                          key={d.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            padding: 10,
                            borderRadius: radius.sm,
                            backgroundColor: t.surfaceAlt,
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
                            <Text
                              style={{
                                fontSize: 13,
                                fontFamily: font.sansSemi,
                                color: t.ink,
                              }}
                            >
                              {p?.name ?? d.peptide_id}
                            </Text>
                            <Text
                              style={{
                                fontSize: 11,
                                color: t.ink3,
                                fontFamily: font.mono,
                                marginTop: 2,
                              }}
                            >
                              {d.amount_mcg} mcg ·{' '}
                              {when.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                              {' · '}
                              {when.toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>

                <Pressable
                  onPress={() => {
                    closeSite();
                    router.replace({
                      pathname: '/log-dose',
                      params: { site: activeSite },
                    } as any);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Log a dose at ${activeSite}`}
                  style={{
                    padding: space.md,
                    borderRadius: radius.md,
                    backgroundColor: t.ink,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: t.bg, fontSize: 14, fontFamily: font.sansSemi }}>
                    Log dose here
                  </Text>
                </Pressable>
                <Pressable
                  onPress={closeSite}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  style={{ padding: space.md, alignItems: 'center' }}
                >
                  <Text style={{ color: t.ink3, fontSize: 14 }}>Cancel</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
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
