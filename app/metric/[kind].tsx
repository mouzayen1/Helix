// Metric series — editorial rebuild. Hero serif numeral for latest
// reading, retinted SVG chart, StatPair for min/avg/max/delta,
// hairline-divided history.
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { HairlineRow } from '../../components/editorial/HairlineRow';
import { StatPair } from '../../components/editorial/StatPair';
import { useEditorialTheme } from '../../lib/design/theme';
import { deleteMetric, listMetrics, METRIC_KINDS, type Metric } from '../../lib/db';

export default function MetricSeries() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const [rows, setRows] = useState<Metric[]>([]);
  const info = METRIC_KINDS.find((k) => k.id === kind);

  const refresh = useCallback(async () => {
    if (kind) setRows(await listMetrics(kind));
  }, [kind]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const stats = useMemo(() => {
    if (rows.length === 0) return null;
    const values = rows.map((r) => r.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const first = rows[rows.length - 1].value;
    const last = rows[0].value;
    const delta = last - first;
    return { min, max, mean, delta, latest: last };
  }, [rows]);

  const chart = useMemo(() => {
    if (rows.length < 2) return null;
    const sorted = [...rows].sort(
      (a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime()
    );
    const W = 300;
    const H = 160;
    const pad = 16;
    const values = sorted.map((r) => r.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const points = sorted.map((r, i) => {
      const x = pad + (i * (W - 2 * pad)) / (sorted.length - 1);
      const y = H - pad - ((r.value - min) / range) * (H - 2 * pad);
      return { x, y, value: r.value, date: r.taken_at };
    });
    const path = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
    return { W, H, points, path, min, max };
  }, [rows]);

  if (!info) return null;

  const onDelete = async (id: string) => {
    await deleteMetric(id);
    refresh();
  };

  return (
    <View style={{ flex: 1, backgroundColor: ed.colors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
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
            ←
          </Text>
        </Pressable>
        <Pressable onPress={() => router.push('/log-metric' as any)} hitSlop={6}>
          <Text
            style={{
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

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 64 }}
        showsVerticalScrollIndicator={false}
      >
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
          {info.label}
        </Text>
        <EditorialHeadline size="title1">{`The *trend*.`}</EditorialHeadline>
        {stats ? (
          <View style={{ marginTop: 18, flexDirection: 'row', alignItems: 'baseline' }}>
            <Text
              style={{
                fontFamily: ed.fraunces('Fraunces_300Light'),
                fontSize: 88,
                lineHeight: 88,
                letterSpacing: -3,
                color: ed.colors.ink1,
              }}
            >
              {stats.latest}
            </Text>
            <Text
              style={{
                marginLeft: 10,
                fontFamily: ed.typography.label.fontFamily,
                fontSize: ed.typography.label.fontSize,
                letterSpacing: ed.typography.label.letterSpacing,
                color: ed.colors.ink3,
                textTransform: 'uppercase',
              }}
            >
              {info.unit}
            </Text>
          </View>
        ) : null}

        {chart ? (
          <View style={{ marginTop: 32 }}>
            <EyebrowLabel withRule>{`${rows.length} readings`}</EyebrowLabel>
            <View style={{ marginTop: 14 }}>
              <Svg width="100%" height={160} viewBox={`0 0 ${chart.W} ${chart.H}`}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Line
                    key={i}
                    x1={16}
                    x2={chart.W - 16}
                    y1={16 + (i * (chart.H - 32)) / 4}
                    y2={16 + (i * (chart.H - 32)) / 4}
                    stroke={ed.colors.line}
                    strokeWidth={1}
                  />
                ))}
                <Path
                  d={chart.path}
                  stroke={ed.colors.brand}
                  strokeWidth={1.5}
                  fill="none"
                  strokeLinejoin="round"
                />
                {chart.points.map((p, i) => (
                  <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={ed.colors.brand} />
                ))}
              </Svg>
            </View>
          </View>
        ) : (
          <View
            style={{
              marginTop: 32,
              paddingVertical: 28,
              alignItems: 'center',
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: ed.colors.line,
            }}
          >
            <Text
              style={{
                fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                fontSize: 17,
                color: ed.colors.ink3,
                textAlign: 'center',
              }}
            >
              Log at least 2 readings to see a trend line.
            </Text>
          </View>
        )}

        {stats ? (
          <View style={{ marginTop: 24 }}>
            <HairlineRow strong />
            <StatPair
              cells={[
                { value: stats.min.toFixed(1), label: 'Min' },
                { value: stats.mean.toFixed(1), label: 'Avg' },
                { value: stats.max.toFixed(1), label: 'Max' },
              ]}
            />
            <HairlineRow strong />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                paddingVertical: 12,
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
                Δ since first
              </Text>
              <Text
                style={{
                  fontFamily: ed.fraunces('Fraunces_400Regular'),
                  fontSize: 22,
                  letterSpacing: -0.4,
                  color:
                    stats.delta > 0
                      ? ed.colors.stateOptimal
                      : stats.delta < 0
                      ? ed.colors.stateLow
                      : ed.colors.ink2,
                }}
              >
                {(stats.delta >= 0 ? '+' : '') + stats.delta.toFixed(1)}
              </Text>
            </View>
            <HairlineRow strong />
          </View>
        ) : null}

        <View style={{ marginTop: 32 }}>
          <EyebrowLabel withRule>History</EyebrowLabel>
          <View style={{ marginTop: 4 }}>
            {rows.map((r, idx) => (
              <View key={r.id}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 16,
                    gap: 14,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                      <Text
                        style={{
                          fontFamily: ed.fraunces('Fraunces_400Regular'),
                          fontSize: 22,
                          letterSpacing: -0.3,
                          color: ed.colors.ink1,
                        }}
                      >
                        {r.value}
                      </Text>
                      <Text
                        style={{
                          marginLeft: 6,
                          fontFamily: ed.typography.labelSm.fontFamily,
                          fontSize: ed.typography.labelSm.fontSize,
                          letterSpacing: ed.typography.labelSm.letterSpacing,
                          color: ed.colors.ink3,
                          textTransform: 'uppercase',
                        }}
                      >
                        {r.unit}
                      </Text>
                    </View>
                    <Text
                      style={{
                        marginTop: 4,
                        fontFamily: ed.typography.dataMd.fontFamily,
                        fontSize: ed.typography.dataMd.fontSize,
                        color: ed.colors.ink3,
                      }}
                    >
                      {new Date(r.taken_at).toLocaleString()}
                    </Text>
                  </View>
                  <Pressable onPress={() => onDelete(r.id)} hitSlop={6}>
                    <Text
                      style={{
                        fontFamily: ed.typography.label.fontFamily,
                        fontSize: ed.typography.label.fontSize,
                        letterSpacing: ed.typography.label.letterSpacing,
                        color: ed.colors.stateWarn,
                        textTransform: 'uppercase',
                      }}
                    >
                      Delete
                    </Text>
                  </Pressable>
                </View>
                {idx < rows.length - 1 ? <HairlineRow /> : null}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
