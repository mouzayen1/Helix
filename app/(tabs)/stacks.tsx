// Stacks — spec v2.0 §10 "Stacks home". Active cycle, past cycles, saved stacks, templates.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronRight, IconPlus } from '../../components/Icons';
import { HCard, HSectionHeader } from '../../components/Primitives';
import {
  listActiveCycles,
  listCycles,
  listStacks,
  type Cycle,
  type Stack,
} from '../../lib/db';
import {
  formatRelativeDue,
  getNextInjectionForCycle,
  getVialsNeededForCycle,
  type NextInjection,
  type VialNeed,
} from '../../lib/cycle-helpers';
import { findPeptide } from '../../lib/peptides';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

const TEMPLATES = [
  {
    id: 'healing',
    name: 'Healing stack',
    goal: 'Healing',
    peptides: ['bpc157', 'tb500', 'ghkcu'],
    desc: 'Classic tissue-repair combo. BPC-157 for GI + joint, TB-500 for systemic remodeling, GHK-Cu for skin + collagen.',
  },
  {
    id: 'gh_opt',
    name: 'GH-optimization stack',
    goal: 'Growth',
    peptides: ['ipamor', 'cjc_nodac'],
    desc: 'Pulsatile GH release via Ipamorelin + pulsatile GHRH via CJC-1295 (no DAC). Pre-bed administration.',
  },
  {
    id: 'fatloss',
    name: 'Fat-loss stack',
    goal: 'Fat-loss',
    peptides: ['sema', 'aod'],
    desc: 'GLP-1 agonist for appetite + insulin sensitivity, AOD-9604 for lipolysis.',
  },
];

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 864e5);
}

export default function StacksScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Multi-cycle: every active or paused cycle gets its own card. The
  // single-active assumption was a real foot-gun — users with concurrent
  // protocols (e.g. healing + fat-loss) would only see the most-recent.
  const [activeCycles, setActiveCycles] = useState<Cycle[]>([]);
  const [past, setPast] = useState<Cycle[]>([]);
  const [stacks, setStacks] = useState<Stack[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [acs, cs, ss] = await Promise.all([
          listActiveCycles(),
          listCycles(),
          listStacks(),
        ]);
        setActiveCycles(acs);
        // Past = anything not active and not paused (active and paused
        // both render in the multi-card section above).
        setPast(cs.filter((c) => c.status !== 'active' && c.status !== 'paused'));
        setStacks(ss);
      })();
    }, [])
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          paddingHorizontal: space.xl,
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text
            style={{
              fontSize: 28,
              fontFamily: font.sansBold,
              color: t.ink,
              letterSpacing: -0.6,
            }}
          >
            Stacks
          </Text>
          <Text style={{ fontSize: 13, color: t.ink3, marginTop: 2 }}>
            Cycles and protocols you are running
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => router.push('/dose-history' as any)}
            style={{
              backgroundColor: t.surface,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: t.line,
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Open dose history"
          >
            <Text style={{ color: t.ink, fontSize: 12, fontFamily: font.sansSemi }}>
              History
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/vials' as any)}
            style={{
              backgroundColor: t.surface,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: t.line,
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Open vial library"
          >
            <Text style={{ color: t.ink, fontSize: 12, fontFamily: font.sansSemi }}>
              Vials
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/cycle/new')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: t.ink,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: radius.pill,
            }}
            hitSlop={6}
          >
            <IconPlus size={14} color={t.bg} />
            <Text style={{ color: t.bg, fontSize: 12, fontFamily: font.sansSemi }}>
              New cycle
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Active cycle cards — one per active/paused cycle, stacked. */}
      {activeCycles.length > 0 ? (
        <View style={{ paddingHorizontal: space.xl, marginTop: space.lg, gap: space.md }}>
          {activeCycles.map((c) => (
            <ActiveCycleCard key={c.id} cycle={c} />
          ))}
        </View>
      ) : (
        <View style={{ paddingHorizontal: space.xl, marginTop: space.lg }}>
          <HCard>
            <Text
              style={{
                fontSize: 11,
                fontFamily: font.sansSemi,
                letterSpacing: 1.2,
                color: t.ink3,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              No active cycle
            </Text>
            <Text style={{ color: t.ink2, fontSize: 14, lineHeight: 21, marginBottom: space.md }}>
              Plan a cycle from scratch, or start from a template below.
            </Text>
            <Pressable
              onPress={() => router.push('/cycle/new')}
              style={{
                padding: space.md,
                borderRadius: radius.md,
                backgroundColor: t.ink,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: t.bg, fontSize: 14, fontFamily: font.sansSemi }}>
                Start a cycle
              </Text>
            </Pressable>
          </HCard>
        </View>
      )}

      {/* Templates */}
      <HSectionHeader title="Templates" />
      <View style={{ paddingHorizontal: space.xl, gap: 10 }}>
        {TEMPLATES.map((tpl) => (
          <Pressable
            key={tpl.id}
            onPress={() =>
              router.push({
                pathname: '/cycle/new',
                params: { template: tpl.id },
              } as any)
            }
            style={{
              backgroundColor: t.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.line,
              padding: space.md,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={{ fontSize: 15, fontFamily: font.sansSemi, color: t.ink }}>
                {tpl.name}
              </Text>
              <Text style={{ fontSize: 10, color: t.ink3, fontFamily: font.sansSemi, letterSpacing: 0.8 }}>
                {tpl.goal.toUpperCase()}
              </Text>
            </View>
            <Text style={{ color: t.ink2, fontSize: 13, lineHeight: 19 }}>{tpl.desc}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
              {tpl.peptides.map((pid) => {
                const p = findPeptide(pid);
                if (!p) return null;
                return (
                  <View
                    key={pid}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: radius.pill,
                      backgroundColor: t.surfaceAlt,
                    }}
                  >
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.color }} />
                    <Text style={{ fontSize: 11, color: t.ink2, fontFamily: font.sansMed }}>
                      {p.name}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Pressable>
        ))}
      </View>

      {/* Saved stacks */}
      {stacks.length > 0 ? (
        <>
          <HSectionHeader
            title="Your stacks"
            action={
              <Text onPress={() => router.push('/stack/new' as any)}>New</Text>
            }
          />
          <View style={{ paddingHorizontal: space.xl, gap: 8 }}>
            {stacks.map((s) => {
              const items = JSON.parse(s.items_json) as { peptide_id: string }[];
              return (
                <Pressable
                  key={s.id}
                  onPress={() => router.push(`/stack/${s.id}` as any)}
                  style={{
                    backgroundColor: t.surface,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: t.line,
                    padding: space.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontFamily: font.sansSemi, color: t.ink }}>
                      {s.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>
                      {items.length} peptide{items.length === 1 ? '' : 's'}
                      {s.goal ? ` · ${s.goal}` : ''}
                    </Text>
                  </View>
                  <IconChevronRight size={14} color={t.ink4} />
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {/* Past cycles */}
      {past.length > 0 ? (
        <>
          <HSectionHeader title="Past cycles" />
          <View style={{ paddingHorizontal: space.xl, gap: 8 }}>
            {past.map((c) => {
              const total = daysBetween(new Date(c.starts_on), new Date(c.ends_on));
              return (
                <Pressable
                  key={c.id}
                  onPress={() => router.push(`/cycle/${c.id}` as any)}
                  style={{
                    backgroundColor: t.surface,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: t.line,
                    padding: space.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontFamily: font.sansSemi, color: t.ink }}>
                      {c.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: t.ink3, fontFamily: font.mono, marginTop: 2 }}>
                      {total} days · {c.status}
                    </Text>
                  </View>
                  <IconChevronRight size={14} color={t.ink4} />
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function ActiveCycleCard({ cycle }: { cycle: Cycle }) {
  const { t } = useTheme();
  const router = useRouter();
  const start = new Date(cycle.starts_on);
  const end = new Date(cycle.ends_on);
  const today = new Date();
  const total = Math.max(1, daysBetween(start, end));
  const day = Math.min(total, Math.max(0, daysBetween(start, today)));
  const pct = Math.round((day / total) * 100);
  const protocol = JSON.parse(cycle.protocol_json || '[]') as {
    peptide_id: string;
    dose_mcg: number;
    freq: string;
  }[];

  const [vialNeeds, setVialNeeds] = useState<VialNeed[]>([]);
  const [nextInjections, setNextInjections] = useState<NextInjection[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [needs, next] = await Promise.all([
        getVialsNeededForCycle(cycle.id),
        getNextInjectionForCycle(cycle.id),
      ]);
      if (cancelled) return;
      setVialNeeds(needs);
      setNextInjections(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [cycle.id]);

  const needyCount = vialNeeds.filter((v) => !v.has_active_vial).length;
  const upcoming = nextInjections.filter((n) => n.state !== 'prn');

  return (
    <Pressable
      onPress={() => router.push(`/cycle/${cycle.id}` as any)}
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.line,
        padding: space.lg,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: space.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 11,
              fontFamily: font.sansSemi,
              letterSpacing: 1.2,
              color: t.accent,
              textTransform: 'uppercase',
            }}
          >
            Active cycle
          </Text>
          <Text style={{ fontSize: 20, fontFamily: font.sansBold, color: t.ink, marginTop: 2 }}>
            {cycle.name}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {needyCount > 0 ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                const first = vialNeeds.find((v) => !v.has_active_vial);
                if (first) {
                  router.push({
                    pathname: '/reconstitute',
                    params: { peptideId: first.peptide_id, cycleId: cycle.id },
                  } as any);
                }
              }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: t.warn,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: font.sansBold,
                  color: t.bg,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                {needyCount} vial{needyCount === 1 ? '' : 's'} needed
              </Text>
            </Pressable>
          ) : null}
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
              backgroundColor: t.accentSoft,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontFamily: font.sansSemi,
                color: t.accentInk,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              {cycle.phase}
            </Text>
          </View>
        </View>
      </View>

      <Text style={{ fontSize: 13, color: t.ink3, fontFamily: font.mono, marginBottom: 4 }}>
        Day {day} of {total} · {pct}%
      </Text>
      {upcoming.length > 0 ? (
        <Text style={{ fontSize: 12, color: t.ink2, marginBottom: 8 }}>
          Next:{' '}
          {upcoming
            .slice(0, 2)
            .map((n) => {
              if (n.state === 'pending_first_dose') return `${n.peptide_name} — log first dose`;
              const label = n.due_at ? formatRelativeDue(n.due_at) : '';
              return `${n.peptide_name} ${label}${n.state === 'overdue' ? ' (overdue)' : ''}`;
            })
            .join(' · ')}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 2, marginBottom: space.md }}>
        {Array.from({ length: Math.min(total, 56) }).map((_, i) => {
          const scaledI = Math.floor((i * total) / Math.min(total, 56));
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: 10,
                borderRadius: 2,
                backgroundColor: scaledI < day ? t.accent : t.surfaceAlt,
                opacity: scaledI < day ? 0.6 + i / 100 : 1,
              }}
            />
          );
        })}
      </View>

      {protocol.length > 0 ? (
        <View style={{ gap: 6 }}>
          {protocol.map((row, i) => {
            const p = findPeptide(row.peptide_id);
            return (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: 4,
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
                <Text style={{ flex: 1, color: t.ink, fontSize: 13, fontFamily: font.sansMed }}>
                  {p?.name ?? row.peptide_id}
                </Text>
                <Text style={{ color: t.ink3, fontSize: 12, fontFamily: font.mono }}>
                  {row.dose_mcg} mcg · {row.freq}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </Pressable>
  );
}
