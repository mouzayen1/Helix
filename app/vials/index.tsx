// Vials index — editorial rebuild. Two-tab segmented (active / history),
// hairline-divided list of vials grouped by peptide.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { HairlineRow } from '../../components/editorial/HairlineRow';
import { useEditorialTheme } from '../../lib/design/theme';
import { getVialHistory, listActiveVials, listDoses, type Dose, type Vial } from '../../lib/db';
import { findPeptide } from '../../lib/peptides';

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
  const ed = useEditorialTheme();
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

  const activeByPeptide = useMemo(() => {
    const groups: Record<string, Vial[]> = {};
    for (const v of active) (groups[v.peptide_id] ||= []).push(v);
    return Object.entries(groups);
  }, [active]);

  return (
    <View style={{ flex: 1, backgroundColor: ed.colors.bg }}>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: 24,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
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
      </View>

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
          Vials
        </Text>
        <EditorialHeadline size="title1">{`Your *inventory*.`}</EditorialHeadline>
      </View>

      {/* Segmented tabs */}
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: 24,
          marginTop: 24,
          marginBottom: 16,
          gap: 6,
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
                paddingVertical: 12,
                alignItems: 'center',
                backgroundColor: on ? ed.colors.ink1 : 'transparent',
                borderWidth: 1,
                borderColor: on ? ed.colors.ink1 : ed.colors.lineStrong,
              }}
            >
              <Text
                style={{
                  fontFamily: ed.typography.labelSm.fontFamily,
                  fontSize: ed.typography.labelSm.fontSize,
                  letterSpacing: ed.typography.labelSm.letterSpacing,
                  color: on ? ed.colors.bg : ed.colors.ink2,
                  textTransform: 'uppercase',
                }}
              >
                {key === 'active' ? 'Active' : 'History'} · {count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 64 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <Text
            style={{
              paddingHorizontal: 24,
              fontFamily: ed.typography.dataMd.fontFamily,
              fontSize: ed.typography.dataMd.fontSize,
              color: ed.colors.ink3,
            }}
          >
            Loading…
          </Text>
        ) : tab === 'active' ? (
          active.length === 0 ? (
            <EmptyState
              title="No active vials."
              body="Reconstitute a vial to start tracking remaining volume and dose history."
              cta="Reconstitute"
              onPress={() => router.push('/reconstitute' as any)}
            />
          ) : (
            <View style={{ paddingHorizontal: 24 }}>
              {activeByPeptide.map(([pid, vs]) => {
                const p = findPeptide(pid);
                return (
                  <View key={pid} style={{ marginBottom: 24 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: ed.colors.line,
                      }}
                    >
                      <View
                        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p?.color ?? ed.colors.ink3 }}
                      />
                      <Text
                        style={{
                          flex: 1,
                          fontFamily: ed.fraunces('Fraunces_400Regular'),
                          fontSize: 19,
                          letterSpacing: -0.3,
                          color: ed.colors.ink1,
                        }}
                      >
                        {p?.name ?? pid}
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
                        {vs.length} vial{vs.length === 1 ? '' : 's'}
                      </Text>
                    </View>
                    {vs.map((v, idx) => (
                      <View key={v.id}>
                        <ActiveVialRow
                          vial={v}
                          onPress={() => router.push(`/vials/${v.id}` as any)}
                        />
                        {idx < vs.length - 1 ? <HairlineRow /> : null}
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          )
        ) : history.length === 0 ? (
          <EmptyState
            title="No past vials yet."
            body="Depleted or deleted vials will show up here with their full dose history."
          />
        ) : (
          <View style={{ paddingHorizontal: 24 }}>
            {history.map((v, idx) => (
              <View key={v.id}>
                <HistoryVialRow
                  vial={v}
                  doseCount={dosesByVial[v.id]?.length ?? 0}
                  onPress={() => router.push(`/vials/${v.id}` as any)}
                />
                {idx < history.length - 1 ? <HairlineRow /> : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ActiveVialRow({ vial, onPress }: { vial: Vial; onPress: () => void }) {
  const ed = useEditorialTheme();
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
      style={{ paddingVertical: 16, gap: 8 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
        <Text
          style={{
            flex: 1,
            fontFamily: ed.fraunces('Fraunces_400Regular'),
            fontSize: 22,
            letterSpacing: -0.4,
            color: ed.colors.ink1,
          }}
        >
          {vial.remaining_mg.toFixed(2)}
          <Text
            style={{
              fontFamily: ed.typography.dataMd.fontFamily,
              fontSize: ed.typography.dataMd.fontSize,
              color: ed.colors.ink3,
            }}
          >
            {' / '}
            {vial.strength_mg} mg
          </Text>
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
          {vial.concentration.toFixed(2)} mg/mL
        </Text>
      </View>
      <View style={{ height: 1, backgroundColor: ed.colors.line }}>
        <View
          style={{
            width: `${Math.round(remainPct * 100)}%`,
            height: 1,
            backgroundColor: remainPct < 0.15 ? ed.colors.stateWarn : ed.colors.brand,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Text
          style={{
            fontFamily: ed.typography.labelSm.fontFamily,
            fontSize: ed.typography.labelSm.fontSize,
            letterSpacing: ed.typography.labelSm.letterSpacing,
            color: ed.colors.ink3,
            textTransform: 'uppercase',
          }}
        >
          Recon {fmtDate(vial.reconstituted_at)}
        </Text>
        {vial.expires_at ? (
          <Text
            style={{
              fontFamily: ed.typography.labelSm.fontFamily,
              fontSize: ed.typography.labelSm.fontSize,
              letterSpacing: ed.typography.labelSm.letterSpacing,
              color: expSoon ? ed.colors.stateWarn : ed.colors.ink3,
              textTransform: 'uppercase',
            }}
          >
            {daysToExp !== null
              ? daysToExp < 0
                ? 'Expired'
                : `Exp in ${daysToExp}d`
              : `Exp ${fmtDate(vial.expires_at)}`}
          </Text>
        ) : null}
      </View>
      {vial.notes ? (
        <Text
          numberOfLines={1}
          style={{
            fontFamily: ed.typography.bodySm.fontFamily,
            fontSize: ed.typography.bodySm.fontSize,
            color: ed.colors.ink3,
          }}
        >
          {vial.notes}
        </Text>
      ) : null}
    </Pressable>
  );
}

function HistoryVialRow({
  vial,
  doseCount,
  onPress,
}: {
  vial: Vial;
  doseCount: number;
  onPress: () => void;
}) {
  const ed = useEditorialTheme();
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
      style={{ paddingVertical: 16, gap: 6 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
        <View
          style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p?.color ?? ed.colors.ink3 }}
        />
        <Text
          style={{
            flex: 1,
            fontFamily: ed.fraunces('Fraunces_400Regular'),
            fontSize: 17,
            letterSpacing: -0.2,
            color: ed.colors.ink2,
          }}
        >
          {p?.name ?? vial.peptide_id}
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
          Depleted
        </Text>
      </View>
      <Text
        style={{
          fontFamily: ed.typography.dataMd.fontFamily,
          fontSize: ed.typography.dataMd.fontSize,
          color: ed.colors.ink3,
        }}
      >
        {fmtDate(vial.reconstituted_at)} → {depletedAt}
        {days !== null ? ` · ${days}d` : ''}
      </Text>
      <Text
        style={{
          fontFamily: ed.typography.dataMd.fontFamily,
          fontSize: ed.typography.dataMd.fontSize,
          color: ed.colors.ink3,
        }}
      >
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
  const ed = useEditorialTheme();
  return (
    <View style={{ paddingHorizontal: 24, alignItems: 'center', gap: 14, paddingVertical: 28 }}>
      <Text
        style={{
          fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
          fontSize: 22,
          letterSpacing: -0.4,
          color: ed.colors.ink2,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontFamily: ed.typography.bodySm.fontFamily,
          fontSize: ed.typography.bodySm.fontSize,
          lineHeight: ed.typography.bodySm.lineHeight,
          color: ed.colors.ink3,
          textAlign: 'center',
          maxWidth: 320,
        }}
      >
        {body}
      </Text>
      {cta && onPress ? <EditorialButton onPress={onPress}>{cta}</EditorialButton> : null}
    </View>
  );
}
