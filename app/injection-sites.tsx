// Injection sites — editorial rebuild. Body map keeps its image + dot
// overlay since the visual is critical to the feature; the surrounding
// chrome (header, suggested-site card, zone list) moves to editorial.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialHeadline } from '../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../components/editorial/EyebrowLabel';
import { useEditorialTheme } from '../lib/design/theme';
import { INJECTION_SITES, siteRecency, siteSuggestion, type SiteSuggestion } from '../lib/db';
import { SiteDetailSheet } from '../components/SiteDetailSheet';

const HUMAN_BODY_IMAGE = require('../assets/images/injection-human.png');
const BODY_MAP_ASPECT_RATIO = 1023 / 1537;

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

type ZoneState = 'next' | 'recent' | 'soon' | 'rested';

function zoneStateFor(days_since: number, suggested: boolean): ZoneState {
  if (suggested) return 'next';
  if (days_since < 3) return 'recent';
  if (days_since < 7) return 'soon';
  return 'rested';
}

export default function InjectionSitesModal() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [recency, setRecency] = useState<SiteSuggestion[]>([]);
  const [suggestion, setSuggestion] = useState<SiteSuggestion | null>(null);
  // When non-null, opens the detail sheet AND highlights that zone on
  // the body figure with a brass ring. The ring fades on dismiss.
  const [openSite, setOpenSite] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([siteRecency(), siteSuggestion()]).then(([r, s]) => {
        setRecency(r);
        setSuggestion(s);
      });
    }, [])
  );

  const colorFor = (zs: ZoneState) =>
    zs === 'next'
      ? ed.colors.brand
      : zs === 'recent'
      ? ed.colors.stateWarn
      : zs === 'soon'
      ? ed.colors.stateModerate
      : ed.colors.stateOptimal;

  return (
    <View style={{ flex: 1, backgroundColor: ed.colors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: 24,
        }}
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
            ×
          </Text>
        </Pressable>
        <Text
          style={{
            fontFamily: ed.typography.label.fontFamily,
            fontSize: ed.typography.label.fontSize,
            letterSpacing: ed.typography.label.letterSpacing,
            color: ed.colors.ink3,
            textTransform: 'uppercase',
          }}
        >
          Injection sites
        </Text>
        <View style={{ width: 16 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 64 }}>
        <View style={{ paddingHorizontal: 24 }}>
          <EditorialHeadline size="title1">{`Rotate *wisely*.`}</EditorialHeadline>
          <Text
            style={{
              marginTop: 8,
              fontFamily: ed.typography.bodySm.fontFamily,
              fontSize: ed.typography.bodySm.fontSize,
              lineHeight: ed.typography.bodySm.lineHeight,
              color: ed.colors.ink3,
            }}
          >
            Regular rotation prevents lipodystrophy and scar tissue.
          </Text>
        </View>

        {/* Body map — kept inside a hairline frame instead of a card. */}
        <View
          style={{
            marginHorizontal: 24,
            marginTop: 28,
            paddingVertical: 24,
            alignItems: 'center',
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: ed.colors.line,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 280,
              aspectRatio: BODY_MAP_ASPECT_RATIO,
              position: 'relative',
            }}
          >
            <Image
              source={HUMAN_BODY_IMAGE}
              resizeMode="contain"
              style={{ width: '100%', height: '100%', opacity: ed.isDark ? 0.7 : 0.5 }}
            />
            {recency.map((r) => {
              const pos = SITE_POSITIONS[r.site as keyof typeof SITE_POSITIONS];
              if (!pos) return null;
              const suggested = r.site === suggestion?.site;
              const isOpen = openSite === r.site;
              const zs = zoneStateFor(r.days_since, suggested);
              const color = colorFor(zs);
              const dotSize = suggested ? 28 : 20;
              const haloSize = dotSize + 14;
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
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {/* Brass halo while the site's detail sheet is open —
                      visual confirmation of which zone the sheet refers
                      to, since the body figure stays visible above it. */}
                  {isOpen ? (
                    <View
                      style={{
                        position: 'absolute',
                        width: haloSize,
                        height: haloSize,
                        borderRadius: haloSize / 2,
                        borderWidth: 1.5,
                        borderColor: ed.colors.brand,
                      }}
                    />
                  ) : null}
                  <View
                    style={{
                      width: dotSize,
                      height: dotSize,
                      borderRadius: dotSize / 2,
                      backgroundColor: suggested ? color : 'transparent',
                      borderWidth: 1.5,
                      borderColor: color,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {r.total_uses > 0 ? (
                      <Text
                        style={{
                          color: suggested ? ed.colors.bg : color,
                          fontFamily: ed.typography.dataMd.fontFamily,
                          fontSize: 10,
                        }}
                      >
                        {r.total_uses}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Legend */}
          <View style={{ flexDirection: 'row', gap: 18, marginTop: 24 }}>
            <Legend color={ed.colors.brand} label="Next" />
            <Legend color={ed.colors.stateWarn} label="<3d" />
            <Legend color={ed.colors.stateModerate} label="3-7d" />
            <Legend color={ed.colors.stateOptimal} label="Rested" />
          </View>
        </View>

        {/* Suggested next */}
        {suggestion ? (
          <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
            <EyebrowLabel withRule>Suggested next</EyebrowLabel>
            <View style={{ paddingTop: 14, gap: 4 }}>
              <Text
                style={{
                  fontFamily: ed.fraunces('Fraunces_300Light'),
                  fontSize: 40,
                  letterSpacing: -1,
                  color: ed.colors.brand,
                }}
              >
                {suggestion.site}
              </Text>
              <Text
                style={{
                  fontFamily: ed.typography.dataMd.fontFamily,
                  fontSize: ed.typography.dataMd.fontSize,
                  color: ed.colors.ink3,
                }}
              >
                {suggestion.days_since >= 999
                  ? 'Never used'
                  : `Last used ${suggestion.days_since}d ago`}
                {' · '}
                {suggestion.total_uses} total uses
              </Text>
            </View>
          </View>
        ) : null}

        {/* Zone list */}
        <View style={{ marginTop: 32, paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>All zones</EyebrowLabel>
          <Text
            style={{
              marginTop: 6,
              fontFamily: ed.typography.bodySm.fontFamily,
              fontSize: ed.typography.bodySm.fontSize,
              color: ed.colors.ink3,
            }}
          >
            Tap a zone to log a dose. Tap the chevron for that zone&apos;s history.
          </Text>
          <View style={{ marginTop: 4 }}>
            {recency.map((r, idx) => {
              const zs = zoneStateFor(r.days_since, r.site === suggestion?.site);
              const color = colorFor(zs);
              return (
                <View
                  key={r.site}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  {/* Primary tap target — short-press routes to Log Dose
                      pre-filled with this site. Same behavior as before. */}
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/log-dose', params: { site: r.site } } as any)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Log dose at ${r.site}`}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 16,
                      gap: 14,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: color,
                      }}
                    />
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: ed.fraunces('Fraunces_400Regular'),
                        fontSize: 17,
                        letterSpacing: -0.2,
                        color: ed.colors.ink1,
                      }}
                    >
                      {r.site}
                    </Text>
                    <Text
                      style={{
                        fontFamily: ed.typography.dataMd.fontFamily,
                        fontSize: ed.typography.dataMd.fontSize,
                        color: ed.colors.ink3,
                      }}
                    >
                      {r.days_since >= 999 ? '—' : `${r.days_since}d ago`}
                    </Text>
                    <Text
                      style={{
                        width: 40,
                        textAlign: 'right',
                        fontFamily: ed.typography.dataMd.fontFamily,
                        fontSize: ed.typography.dataMd.fontSize,
                        color: ed.colors.ink3,
                      }}
                    >
                      {r.total_uses}×
                    </Text>
                  </Pressable>
                  {/* Secondary affordance — chevron opens the detail sheet
                      with this site's logged-dose history. Visible cue
                      so the gesture is discoverable; no long-press
                      hidden interactions. */}
                  <Pressable
                    onPress={() => setOpenSite(r.site)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`View dose history at ${r.site}`}
                    style={{
                      paddingVertical: 16,
                      paddingLeft: 8,
                      paddingRight: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: ed.fraunces('Fraunces_300Light'),
                        fontSize: 22,
                        color: ed.colors.ink3,
                      }}
                    >
                      ›
                    </Text>
                  </Pressable>
                  {idx < recency.length - 1 ? (
                    <View
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: 1,
                        backgroundColor: ed.colors.line,
                      }}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <SiteDetailSheet
        site={openSite}
        onClose={() => setOpenSite(null)}
        onLogDose={(site) => {
          setOpenSite(null);
          router.push({ pathname: '/log-dose', params: { site } } as any);
        }}
      />
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const ed = useEditorialTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text
        style={{
          fontFamily: ed.typography.labelSm.fontFamily,
          fontSize: ed.typography.labelSm.fontSize,
          letterSpacing: ed.typography.labelSm.letterSpacing,
          color: ed.colors.ink3,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
