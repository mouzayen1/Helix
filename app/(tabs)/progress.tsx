// Progress — spec v2.0 §10 "Progress home". Tiles, journal preview, insights.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconBook, IconChart, IconChevronRight } from '../../components/Icons';
import { HCard, HSectionHeader } from '../../components/Primitives';
import {
  listAllMetricKindsWithLatest,
  listJournal,
  type JournalEntry,
  type Metric,
  METRIC_KINDS,
} from '../../lib/db';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

export default function ProgressScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tiles, setTiles] = useState<{ kind: string; latest: Metric | null }[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [ts, js] = await Promise.all([
          listAllMetricKindsWithLatest(),
          listJournal(5),
        ]);
        setTiles(ts.filter((x) => x.latest));
        setJournal(js);
      })();
    }, [])
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: space.xl }}>
        <Text
          style={{
            fontSize: 28,
            fontFamily: font.sansBold,
            color: t.ink,
            letterSpacing: -0.6,
          }}
        >
          Progress
        </Text>
        <Text style={{ fontSize: 13, color: t.ink3, marginTop: 2 }}>
          Metrics, journals, trends
        </Text>
      </View>

      {/* Metric tiles */}
      <HSectionHeader
        title="Metrics"
        action={<Text onPress={() => router.push('/log-metric' as any)}>Add</Text>}
      />
      {tiles.length === 0 ? (
        <View style={{ paddingHorizontal: space.xl }}>
          <HCard>
            <Text style={{ color: t.ink3, fontSize: 14, lineHeight: 20, marginBottom: space.md }}>
              Nothing logged yet. Start tracking weight, sleep, labs, and see trends over time.
            </Text>
            <Pressable
              onPress={() => router.push('/log-metric' as any)}
              style={{
                padding: space.md,
                borderRadius: radius.md,
                backgroundColor: t.ink,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: t.bg, fontFamily: font.sansSemi, fontSize: 14 }}>
                Log your first metric
              </Text>
            </Pressable>
          </HCard>
        </View>
      ) : (
        <View
          style={{
            paddingHorizontal: space.xl,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          {tiles.map(({ kind, latest }) => {
            const info = METRIC_KINDS.find((k) => k.id === kind);
            if (!latest || !info) return null;
            return (
              <Pressable
                key={kind}
                onPress={() => router.push(`/metric/${kind}` as any)}
                style={{
                  width: '48.5%',
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
                  {info.label}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
                  <Text style={{ fontSize: 22, fontFamily: font.monoSemi, color: t.ink }}>
                    {latest.value.toString()}
                  </Text>
                  <Text style={{ fontSize: 12, color: t.ink3, marginLeft: 4 }}>
                    {info.unit}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: t.ink4, marginTop: 4 }}>
                  {new Date(latest.taken_at).toLocaleDateString()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Journal preview */}
      <HSectionHeader
        title="Journal"
        action={<Text onPress={() => router.push('/journal-entry' as any)}>New</Text>}
      />
      {journal.length === 0 ? (
        <View style={{ paddingHorizontal: space.xl }}>
          <HCard>
            <Text style={{ color: t.ink3, fontSize: 14, lineHeight: 20, marginBottom: space.md }}>
              A daily line or two about how you feel. Pattern insights unlock at 14 entries.
            </Text>
            <Pressable
              onPress={() => router.push('/journal-entry' as any)}
              style={{
                padding: space.md,
                borderRadius: radius.md,
                backgroundColor: t.ink,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: t.bg, fontFamily: font.sansSemi, fontSize: 14 }}>
                Write today's entry
              </Text>
            </Pressable>
          </HCard>
        </View>
      ) : (
        <View style={{ paddingHorizontal: space.xl, gap: 8 }}>
          {journal.map((j) => (
            <View
              key={j.id}
              style={{
                backgroundColor: t.surface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: t.line,
                padding: space.md,
                gap: 6,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: t.ink, fontSize: 14, fontFamily: font.sansSemi }}>
                  {new Date(j.entry_date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
                <Text style={{ color: t.ink3, fontSize: 12, fontFamily: font.mono }}>
                  mood {j.mood ?? '—'} · energy {j.energy ?? '—'}
                </Text>
              </View>
              {j.body ? (
                <Text style={{ color: t.ink2, fontSize: 13, lineHeight: 19 }} numberOfLines={3}>
                  {j.body}
                </Text>
              ) : null}
              {JSON.parse(j.tags_json).length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {(JSON.parse(j.tags_json) as string[]).map((tag) => (
                    <View
                      key={tag}
                      style={{
                        paddingVertical: 2,
                        paddingHorizontal: 7,
                        borderRadius: radius.pill,
                        backgroundColor: t.surfaceAlt,
                      }}
                    >
                      <Text style={{ fontSize: 10, color: t.ink2, fontFamily: font.sansMed }}>
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {/* Insights placeholder */}
      {journal.length < 14 ? (
        <View style={{ paddingHorizontal: space.xl, marginTop: space.xl }}>
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
              Pattern insights
            </Text>
            <Text style={{ color: t.ink2, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
              Keep logging — automatic pattern insights unlock after you have 14
              journal entries. ({journal.length}/14)
            </Text>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
