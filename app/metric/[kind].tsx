// Metric time series — spec v2.0 §10.
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { IconChevronLeft, IconPlus } from '../../components/Icons';
import { deleteMetric, listMetrics, METRIC_KINDS, type Metric } from '../../lib/db';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

export default function MetricSeries() {
  const { t } = useTheme();
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

  // Chart: oldest → newest left→right
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
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: insets.top + space.sm,
          paddingBottom: space.md,
          paddingHorizontal: space.xl,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconChevronLeft size={18} color={t.ink2} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/log-metric' as any)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: t.line,
          }}
          hitSlop={6}
        >
          <IconPlus size={12} color={t.ink2} />
          <Text style={{ color: t.ink2, fontSize: 12, fontFamily: font.sansMed }}>
            Log
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: insets.bottom + 40 }}
      >
        <Text
          style={{
            fontSize: 28,
            fontFamily: font.sansBold,
            color: t.ink,
            letterSpacing: -0.6,
          }}
        >
          {info.label}
        </Text>
        {stats ? (
          <Text style={{ color: t.ink3, fontSize: 40, fontFamily: font.monoSemi, marginTop: 4 }}>
            {stats.latest}
            <Text style={{ fontSize: 16 }}> {info.unit}</Text>
          </Text>
        ) : null}

        {chart ? (
          <View
            style={{
              marginTop: space.xl,
              padding: space.md,
              backgroundColor: t.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.line,
            }}
          >
            <Svg width="100%" height={160} viewBox={`0 0 ${chart.W} ${chart.H}`}>
              {/* Grid */}
              {[0, 1, 2, 3, 4].map((i) => (
                <Line
                  key={i}
                  x1={16}
                  x2={chart.W - 16}
                  y1={16 + (i * (chart.H - 32)) / 4}
                  y2={16 + (i * (chart.H - 32)) / 4}
                  stroke={t.line}
                  strokeWidth={1}
                />
              ))}
              <Path d={chart.path} stroke={t.accent} strokeWidth={2} fill="none" strokeLinejoin="round" />
              {chart.points.map((p, i) => (
                <Circle key={i} cx={p.x} cy={p.y} r={3} fill={t.accent} />
              ))}
            </Svg>
          </View>
        ) : (
          <View
            style={{
              marginTop: space.xl,
              padding: space.xl,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.line,
              borderStyle: 'dashed',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: t.ink3, fontSize: 13 }}>
              Log at least 2 readings to see a trend line.
            </Text>
          </View>
        )}

        {stats ? (
          <View
            style={{
              marginTop: space.md,
              flexDirection: 'row',
              justifyContent: 'space-between',
              padding: space.md,
              backgroundColor: t.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.line,
            }}
          >
            {[
              { label: 'Min', val: stats.min.toFixed(1) },
              { label: 'Avg', val: stats.mean.toFixed(1) },
              { label: 'Max', val: stats.max.toFixed(1) },
              { label: 'Δ', val: (stats.delta >= 0 ? '+' : '') + stats.delta.toFixed(1) },
            ].map((s) => (
              <View key={s.label} style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 10, color: t.ink3, letterSpacing: 0.8, fontFamily: font.sansSemi, textTransform: 'uppercase' }}>
                  {s.label}
                </Text>
                <Text style={{ fontSize: 16, fontFamily: font.monoSemi, color: t.ink, marginTop: 4 }}>
                  {s.val}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text
          style={{
            marginTop: space.xl,
            fontSize: 11,
            color: t.ink3,
            letterSpacing: 1.2,
            fontFamily: font.sansSemi,
            textTransform: 'uppercase',
          }}
        >
          History
        </Text>
        <View style={{ gap: 6, marginTop: space.sm }}>
          {rows.map((r) => (
            <View
              key={r.id}
              style={{
                backgroundColor: t.surface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: t.line,
                padding: space.md,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.ink, fontSize: 15, fontFamily: font.monoSemi }}>
                  {r.value} {r.unit}
                </Text>
                <Text style={{ color: t.ink3, fontSize: 11, marginTop: 2 }}>
                  {new Date(r.taken_at).toLocaleString()}
                </Text>
              </View>
              <Pressable onPress={() => onDelete(r.id)} hitSlop={6}>
                <Text style={{ color: t.danger, fontSize: 12, fontFamily: font.sansSemi }}>
                  Delete
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
