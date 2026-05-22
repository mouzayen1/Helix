// Progress — editorial rebuild. Cost rollup uses StatPair, metric tiles
// become hairline-divided rows with serif numerals + mono labels,
// journal preview matches the Cycle Detail / Today schedule rhythm.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { HairlineRow } from '../../components/editorial/HairlineRow';
import { StatPair } from '../../components/editorial/StatPair';
import { useEditorialTheme } from '../../lib/design/theme';
import {
  getActiveCycle,
  getVialHistory,
  listActiveVials,
  listAllMetricKindsWithLatest,
  listJournal,
  type Cycle,
  type JournalEntry,
  type Metric,
  METRIC_KINDS,
  type Vial,
} from '../../lib/db';

export default function ProgressScreen() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tiles, setTiles] = useState<{ kind: string; latest: Metric | null }[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);
  const [allVials, setAllVials] = useState<Vial[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [ts, js, c, active, past] = await Promise.all([
          listAllMetricKindsWithLatest(),
          listJournal(5),
          getActiveCycle(),
          listActiveVials(),
          getVialHistory({ limit: 500 }),
        ]);
        setTiles(ts.filter((x) => x.latest));
        setJournal(js);
        setActiveCycle(c);
        setAllVials([...active, ...past]);
      })();
    }, [])
  );

  const costSummary = useMemo(() => {
    const withCost = allVials.filter((v) => v.cost_usd != null && v.cost_usd > 0);
    if (withCost.length === 0) return null;
    const total = withCost.reduce((s, v) => s + (v.cost_usd ?? 0), 0);
    const doses = withCost.reduce((s, v) => s + (v.total_doses_drawn ?? 0), 0);
    const perDose = doses > 0 ? total / doses : null;
    const cycleCost = activeCycle
      ? withCost
          .filter(
            (v) =>
              v.reconstituted_at >= activeCycle.starts_on &&
              v.reconstituted_at <= activeCycle.ends_on
          )
          .reduce((s, v) => s + (v.cost_usd ?? 0), 0)
      : null;
    return { total, doses, perDose, cycleCost };
  }, [allVials, activeCycle]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: ed.colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ paddingHorizontal: 24 }}>
        <Text
          style={{
            fontFamily: ed.typography.eyebrow.fontFamily,
            fontSize: ed.typography.eyebrow.fontSize,
            letterSpacing: ed.typography.eyebrow.letterSpacing,
            color: ed.colors.ink3,
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          Progress
        </Text>
        <EditorialHeadline size="title1">{`The *trend* line.`}</EditorialHeadline>
        <Text
          style={{
            marginTop: 8,
            fontFamily: ed.typography.bodySm.fontFamily,
            fontSize: ed.typography.bodySm.fontSize,
            lineHeight: ed.typography.bodySm.lineHeight,
            color: ed.colors.ink3,
          }}
        >
          Metrics, journals, patterns.
        </Text>
      </View>

      {/* Cost rollup */}
      {costSummary ? (
        <View style={{ marginTop: 32, paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>Cost</EyebrowLabel>
          <HairlineRow strong style={{ marginTop: 4 }} />
          <StatPair
            cells={[
              {
                value: `$${costSummary.total.toFixed(0)}`,
                label: 'Total',
                color: 'brand',
              },
              {
                value: costSummary.perDose != null ? `$${costSummary.perDose.toFixed(2)}` : '—',
                label: 'Per dose',
              },
              ...(costSummary.cycleCost != null
                ? [
                    {
                      value: `$${costSummary.cycleCost.toFixed(0)}`,
                      label: 'This cycle',
                    },
                  ]
                : []),
            ]}
          />
          <HairlineRow strong />
        </View>
      ) : null}

      {/* Metric tiles */}
      <View style={{ marginTop: 36, paddingHorizontal: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <EyebrowLabel withRule>Metrics</EyebrowLabel>
          <Pressable onPress={() => router.push('/log-metric' as any)} hitSlop={8}>
            <Text
              style={{
                marginLeft: 12,
                fontFamily: ed.typography.label.fontFamily,
                fontSize: ed.typography.label.fontSize,
                letterSpacing: ed.typography.label.letterSpacing,
                color: ed.colors.brand,
                textTransform: 'uppercase',
              }}
            >
              + Log
            </Text>
          </Pressable>
        </View>
        {tiles.length === 0 ? (
          <View style={{ paddingVertical: 28, alignItems: 'center', gap: 14 }}>
            <Text
              style={{
                fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                fontSize: 19,
                color: ed.colors.ink2,
                textAlign: 'center',
              }}
            >
              Nothing logged yet.
            </Text>
            <Text
              style={{
                fontFamily: ed.typography.bodySm.fontFamily,
                fontSize: ed.typography.bodySm.fontSize,
                lineHeight: ed.typography.bodySm.lineHeight,
                color: ed.colors.ink3,
                textAlign: 'center',
                maxWidth: 280,
              }}
            >
              Track weight, sleep, labs, see trends over time.
            </Text>
            <EditorialButton onPress={() => router.push('/log-metric' as any)}>
              Log first metric
            </EditorialButton>
          </View>
        ) : (
          <View style={{ marginTop: 4 }}>
            {tiles.map(({ kind, latest }, idx) => {
              const info = METRIC_KINDS.find((k) => k.id === kind);
              if (!latest || !info) return null;
              return (
                <View key={kind}>
                  <Pressable
                    onPress={() => router.push(`/metric/${kind}` as any)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'baseline',
                      paddingVertical: 18,
                      gap: 12,
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: ed.typography.label.fontFamily,
                        fontSize: ed.typography.label.fontSize,
                        letterSpacing: ed.typography.label.letterSpacing,
                        color: ed.colors.ink3,
                        textTransform: 'uppercase',
                      }}
                    >
                      {info.label}
                    </Text>
                    <Text
                      style={{
                        fontFamily: ed.fraunces('Fraunces_300Light'),
                        fontSize: 32,
                        letterSpacing: -0.6,
                        color: ed.colors.ink1,
                      }}
                    >
                      {latest.value.toString()}
                    </Text>
                    <Text
                      style={{
                        fontFamily: ed.typography.labelSm.fontFamily,
                        fontSize: ed.typography.labelSm.fontSize,
                        letterSpacing: ed.typography.labelSm.letterSpacing,
                        color: ed.colors.ink3,
                        textTransform: 'uppercase',
                      }}
                    >
                      {info.unit}
                    </Text>
                  </Pressable>
                  {idx < tiles.length - 1 ? <HairlineRow /> : null}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Journal preview */}
      <View style={{ marginTop: 36, paddingHorizontal: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <EyebrowLabel withRule>Journal</EyebrowLabel>
          <Pressable onPress={() => router.push('/journal-entry' as any)} hitSlop={8}>
            <Text
              style={{
                marginLeft: 12,
                fontFamily: ed.typography.label.fontFamily,
                fontSize: ed.typography.label.fontSize,
                letterSpacing: ed.typography.label.letterSpacing,
                color: ed.colors.brand,
                textTransform: 'uppercase',
              }}
            >
              + Write
            </Text>
          </Pressable>
        </View>

        {journal.length === 0 ? (
          <View style={{ paddingVertical: 28, alignItems: 'center', gap: 14 }}>
            <Text
              style={{
                fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                fontSize: 19,
                color: ed.colors.ink2,
                textAlign: 'center',
              }}
            >
              No entries yet.
            </Text>
            <Text
              style={{
                fontFamily: ed.typography.bodySm.fontFamily,
                fontSize: ed.typography.bodySm.fontSize,
                lineHeight: ed.typography.bodySm.lineHeight,
                color: ed.colors.ink3,
                textAlign: 'center',
                maxWidth: 280,
              }}
            >
              A daily line or two. Pattern insights unlock at 14 entries.
            </Text>
            <EditorialButton onPress={() => router.push('/journal-entry' as any)}>
              Write today's entry
            </EditorialButton>
          </View>
        ) : (
          <View style={{ marginTop: 4 }}>
            {journal.map((j, idx) => {
              const tags = (() => {
                try {
                  return JSON.parse(j.tags_json) as string[];
                } catch {
                  return [];
                }
              })();
              return (
                <View key={j.id}>
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/journal-entry', params: { date: j.entry_date } } as any)
                    }
                    style={{ paddingVertical: 16, gap: 6 }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: ed.typography.label.fontFamily,
                          fontSize: ed.typography.label.fontSize,
                          letterSpacing: ed.typography.label.letterSpacing,
                          color: ed.colors.ink3,
                          textTransform: 'uppercase',
                        }}
                      >
                        {new Date(j.entry_date)
                          .toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })
                          .toUpperCase()}
                      </Text>
                      <Text
                        style={{
                          fontFamily: ed.typography.dataMd.fontFamily,
                          fontSize: ed.typography.dataMd.fontSize,
                          color: ed.colors.ink3,
                        }}
                      >
                        mood {j.mood ?? '—'} · energy {j.energy ?? '—'}
                      </Text>
                    </View>
                    {j.body ? (
                      <Text
                        numberOfLines={3}
                        style={{
                          fontFamily: ed.fraunces('Fraunces_400Regular'),
                          fontSize: 16,
                          lineHeight: 24,
                          letterSpacing: -0.2,
                          color: ed.colors.ink1,
                        }}
                      >
                        {j.body}
                      </Text>
                    ) : null}
                    {tags.length > 0 ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        {tags.map((tag) => (
                          <View
                            key={tag}
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderWidth: 1,
                              borderColor: ed.colors.line,
                            }}
                          >
                            <Text
                              style={{
                                fontFamily: ed.typography.labelSm.fontFamily,
                                fontSize: ed.typography.labelSm.fontSize,
                                letterSpacing: ed.typography.labelSm.letterSpacing,
                                color: ed.colors.ink3,
                                textTransform: 'uppercase',
                              }}
                            >
                              {tag}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </Pressable>
                  {idx < journal.length - 1 ? <HairlineRow /> : null}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Insights tease */}
      {journal.length > 0 && journal.length < 14 ? (
        <View style={{ marginTop: 32, paddingHorizontal: 24 }}>
          <View
            style={{
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: ed.colors.brandLine,
              paddingVertical: 16,
              gap: 6,
            }}
          >
            <Text
              style={{
                fontFamily: ed.typography.label.fontFamily,
                fontSize: ed.typography.label.fontSize,
                letterSpacing: ed.typography.label.letterSpacing,
                color: ed.colors.brand,
                textTransform: 'uppercase',
              }}
            >
              Pattern insights
            </Text>
            <Text
              style={{
                fontFamily: ed.typography.bodyMd.fontFamily,
                fontSize: ed.typography.bodyMd.fontSize,
                lineHeight: ed.typography.bodyMd.lineHeight,
                color: ed.colors.ink2,
              }}
            >
              Pattern insights unlock at 14 entries. ({journal.length}/14)
            </Text>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
