// Vial management — list of active + depleted vials. v1.1 Phase 3.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronLeft, IconChevronRight } from '../../components/Icons';
import {
  getVialHistory,
  listActiveVials,
  listDoses,
  type Dose,
  type Vial,
} from '../../lib/db';
import { findPeptide } from '../../lib/peptides';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

type Tab = 'active' | 'history';

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function VialsScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>('active');
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Vial[]>([]);
  const [history, setHistory] = useState<Vial[]>([]);
  const [dosesByVial, setDosesByVial] = useState<Record<string, Dose[]>>({});

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        const [a, h, allDoses] = await Promise.all([
          listActiveVials(),
          getVialHistory({ limit: 200 }),
          listDoses({ limit: 1000 }),
        ]);
        if (!alive) return;
        const byVial: Record<string, Dose[]> = {};
        for (const d of allDoses) {
          if (!d.vial_id) continue;
          (byVial[d.vial_id] ||= []).push(d);
        }
        setActive(a);
        setHistory(h);
        setDosesByVial(byVial);
        setLoading(false);
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  // Group active vials by peptide for cleaner list rendering.
  const activeByPeptide = useMemo(() => {
    const groups: Record<string, Vial[]> = {};
    for (const v of active) (groups[v.peptide_id] ||= []).push(v);
    return Object.entries(groups);
  }, [active]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + space.md,
          paddingBottom: space.md,
          paddingHorizontal: space.xl,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <IconChevronLeft size={18} color={t.ink} />
        </Pressable>
        <Text style={{ fontSize: 20, fontFamily: font.sansBold, color: t.ink }}>My vials</Text>
      </View>

      {/* Segmented tabs */}
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: space.xl,
          padding: 3,
          backgroundColor: t.surfaceAlt,
          borderRadius: radius.md,
          marginBottom: space.md,
        }}
      >
        {(['active', 'history'] as const).map((key) => {
          const on = tab === key;
          const count = key === 'active' ? active.length : history.length;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: radius.md - 3,
                backgroundColor: on ? t.surface : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: on ? t.ink : t.ink3,
                  fontFamily: font.sansSemi,
                }}
              >
                {key === 'active' ? 'Active' : 'History'} · {count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space['2xl'] }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <Text
            style={{
              paddingHorizontal: space.xl,
              color: t.ink3,
              fontSize: 13,
            }}
          >
            Loading vials…
          </Text>
        ) : tab === 'active' ? (
          active.length === 0 ? (
            <EmptyState
              title="No active vials"
              body="Reconstitute a vial to start tracking remaining volume and dose history."
              cta="Reconstitute"
              onPress={() => router.push('/reconstitute' as any)}
            />
          ) : (
            <View style={{ paddingHorizontal: space.xl, gap: space.md }}>
              {activeByPeptide.map(([pid, vs]) => {
                const p = findPeptide(pid);
                return (
                  <View key={pid} style={{ gap: 8 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: p?.color ?? t.ink3,
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: font.sansSemi,
                          color: t.ink,
                        }}
                      >
                        {p?.name ?? pid}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: t.ink3,
                          fontFamily: font.mono,
                        }}
                      >
                        {vs.length} vial{vs.length === 1 ? '' : 's'}
                      </Text>
                    </View>
                    {vs.map((v) => (
                      <ActiveVialCard
                        key={v.id}
                        vial={v}
                        onPress={() => router.push(`/vials/${v.id}` as any)}
                      />
                    ))}
                  </View>
                );
              })}
            </View>
          )
        ) : history.length === 0 ? (
          <EmptyState
            title="No past vials yet"
            body="Depleted or deleted vials will show up here with their full dose history."
          />
        ) : (
          <View style={{ paddingHorizontal: space.xl, gap: 10 }}>
            {history.map((v) => (
              <HistoryVialCard
                key={v.id}
                vial={v}
                doseCount={dosesByVial[v.id]?.length ?? 0}
                onPress={() => router.push(`/vials/${v.id}` as any)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ActiveVialCard({ vial, onPress }: { vial: Vial; onPress: () => void }) {
  const { t } = useTheme();
  const remainPct = Math.max(
    0,
    Math.min(1, vial.remaining_mg / Math.max(0.0001, vial.strength_mg))
  );
  const daysToExp = daysUntil(vial.expires_at);
  const expSoon = daysToExp !== null && daysToExp <= 3;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open vial, ${vial.remaining_mg.toFixed(2)} of ${vial.strength_mg} mg remaining`}
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: t.line,
        padding: space.md,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text
          style={{
            flex: 1,
            fontSize: 13,
            fontFamily: font.monoSemi,
            color: t.ink,
          }}
        >
          {vial.remaining_mg.toFixed(2)} / {vial.strength_mg} mg
        </Text>
        <Text style={{ fontSize: 11, color: t.ink3, fontFamily: font.mono }}>
          {vial.concentration.toFixed(2)} mg/mL
        </Text>
        <IconChevronRight size={12} color={t.ink4} />
      </View>
      <View
        style={{
          height: 6,
          backgroundColor: t.surfaceAlt,
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.round(remainPct * 100)}%`,
            height: 6,
            backgroundColor: remainPct < 0.15 ? t.warn : t.accent,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 11, color: t.ink3, fontFamily: font.mono }}>
          Recon {fmtDate(vial.reconstituted_at)}
        </Text>
        {vial.expires_at ? (
          <Text
            style={{
              fontSize: 11,
              fontFamily: font.monoSemi,
              color: expSoon ? t.danger : t.ink3,
            }}
          >
            {daysToExp !== null
              ? daysToExp < 0
                ? 'EXPIRED'
                : `exp in ${daysToExp}d`
              : `exp ${fmtDate(vial.expires_at)}`}
          </Text>
        ) : null}
      </View>
      {vial.notes ? (
        <Text numberOfLines={1} style={{ fontSize: 12, color: t.ink3 }}>
          {vial.notes}
        </Text>
      ) : null}
    </Pressable>
  );
}

function HistoryVialCard({
  vial,
  doseCount,
  onPress,
}: {
  vial: Vial;
  doseCount: number;
  onPress: () => void;
}) {
  const { t } = useTheme();
  const p = findPeptide(vial.peptide_id);
  const depletedAt = vial.depleted_at ? fmtDate(vial.depleted_at) : '—';
  const days = vial.depleted_at
    ? Math.max(
        1,
        Math.round(
          (new Date(vial.depleted_at).getTime() - new Date(vial.reconstituted_at).getTime()) /
            864e5
        )
      )
    : null;
  const dosesPerWeek = days ? (doseCount / days) * 7 : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open depleted vial, ${p?.name ?? vial.peptide_id}`}
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: t.line,
        padding: space.md,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: p?.color ?? t.ink3,
          }}
        />
        <Text style={{ flex: 1, fontSize: 14, fontFamily: font.sansSemi, color: t.ink }}>
          {p?.name ?? vial.peptide_id}
        </Text>
        <Text
          style={{
            fontSize: 10,
            fontFamily: font.sansSemi,
            color: t.ink3,
            letterSpacing: 0.8,
          }}
        >
          DEPLETED
        </Text>
        <IconChevronRight size={12} color={t.ink4} />
      </View>
      <Text style={{ fontSize: 11, color: t.ink3, fontFamily: font.mono }}>
        {fmtDate(vial.reconstituted_at)} → {depletedAt}
        {days !== null ? ` · ${days}d` : ''}
      </Text>
      <Text style={{ fontSize: 11, color: t.ink3, fontFamily: font.mono }}>
        {vial.total_doses_drawn || doseCount} doses
        {dosesPerWeek !== null ? ` · ${dosesPerWeek.toFixed(1)}/wk` : ''}
        {vial.cost_usd ? ` · $${vial.cost_usd.toFixed(0)}` : ''}
      </Text>
    </Pressable>
  );
}

function EmptyState({
  title,
  body,
  cta,
  onPress,
}: {
  title: string;
  body: string;
  cta?: string;
  onPress?: () => void;
}) {
  const { t } = useTheme();
  return (
    <View style={{ paddingHorizontal: space.xl, gap: 10, alignItems: 'flex-start' }}>
      <Text style={{ fontSize: 14, fontFamily: font.sansSemi, color: t.ink }}>{title}</Text>
      <Text style={{ fontSize: 13, color: t.ink3, lineHeight: 19 }}>{body}</Text>
      {cta && onPress ? (
        <Pressable
          onPress={onPress}
          style={{
            marginTop: 4,
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: radius.pill,
            backgroundColor: t.ink,
          }}
        >
          <Text style={{ color: t.bg, fontSize: 13, fontFamily: font.sansSemi }}>{cta}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
