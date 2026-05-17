// Stacks — editorial rebuild. Active cycle hero, three template cards
// rendered as hairline-divided list rows, saved stacks + past cycles
// follow the same rhythm. New-cycle CTA is an EditorialButton in the
// header rail.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { HairlineRow } from '../../components/editorial/HairlineRow';
import { HeroRing } from '../../components/editorial/HeroRing';
import { StatPair } from '../../components/editorial/StatPair';
import { useEditorialTheme } from '../../lib/design/theme';
import { DoseValue } from '../../components/editorial/DoseUnitChip';
import { listActiveCycles, listCycles, listDoses, listStacks, type Cycle, type Stack } from '../../lib/db';
import { findPeptide } from '../../lib/peptides';

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
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState<Cycle[]>([]);
  const [past, setPast] = useState<Cycle[]>([]);
  const [stacks, setStacks] = useState<Stack[]>([]);
  // Last-30-days dose count drives the Recent Activity NavRow caption.
  // Recomputed on focus so the number always matches what dose-history
  // shows when the user taps through.
  const [doses30d, setDoses30d] = useState<number>(0);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
        const [a, cs, ss, recent] = await Promise.all([
          listActiveCycles(),
          listCycles(),
          listStacks(),
          listDoses({ from: since }),
        ]);
        setActive(a);
        // listActiveCycles covers status IN (active, paused); exclude both
        // from Past so a paused cycle never renders in two sections.
        setPast(cs.filter((c) => c.status !== 'active' && c.status !== 'paused'));
        setStacks(ss);
        setDoses30d(recent.length);
      })();
    }, [])
  );

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
          Stacks
        </Text>
        <EditorialHeadline size="title1">{`Cycles you're *running*.`}</EditorialHeadline>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          <EditorialButton onPress={() => router.push('/cycle/new')}>+ New cycle</EditorialButton>
          <EditorialButton variant="secondary" onPress={() => router.push('/vials' as any)}>
            Vials
          </EditorialButton>
        </View>
      </View>

      {/* Recent activity — entry point to the full dose history. Lives
          here (not in Settings) because dose history is primary
          historical data, conceptually adjacent to active cycles and
          past cycles already on this tab. */}
      <View style={{ marginTop: 32, paddingHorizontal: 24 }}>
        <EyebrowLabel withRule>Recent activity</EyebrowLabel>
        <Pressable
          onPress={() => router.push('/dose-history' as any)}
          accessibilityRole="button"
          accessibilityLabel="Open dose history"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 18,
            gap: 12,
          }}
        >
          <Text
            style={{
              flex: 1,
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 17,
              letterSpacing: -0.2,
              color: ed.colors.ink1,
            }}
          >
            {doses30d === 0
              ? 'No doses logged yet'
              : `${doses30d} dose${doses30d === 1 ? '' : 's'} · last 30 days`}
          </Text>
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
        <HairlineRow strong />
      </View>

      {/* Active cycles — one hero per concurrent cycle. */}
      {active.length > 0 ? (
        active.map((c, i) => (
          <View key={c.id}>
            {i > 0 ? (
              <View style={{ marginTop: 32, paddingHorizontal: 24 }}>
                <HairlineRow strong />
              </View>
            ) : null}
            <ActiveCycleHero cycle={c} />
          </View>
        ))
      ) : (
        <View style={{ marginTop: 32, paddingHorizontal: 24 }}>
          <HairlineRow strong />
          <View style={{ paddingVertical: 28, alignItems: 'center', gap: 14 }}>
            <Text
              style={{
                fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                fontSize: 22,
                letterSpacing: -0.4,
                color: ed.colors.ink2,
              }}
            >
              No active cycle.
            </Text>
            <Text
              style={{
                fontFamily: ed.typography.bodySm.fontFamily,
                fontSize: ed.typography.bodySm.fontSize,
                lineHeight: ed.typography.bodySm.lineHeight,
                color: ed.colors.ink3,
                textAlign: 'center',
                maxWidth: 300,
              }}
            >
              Plan one from scratch, or start from a template below.
            </Text>
          </View>
          <HairlineRow strong />
        </View>
      )}

      {/* Templates */}
      <View style={{ marginTop: 36, paddingHorizontal: 24 }}>
        <EyebrowLabel withRule>Templates</EyebrowLabel>
        <View style={{ marginTop: 4 }}>
          {TEMPLATES.map((tpl, idx) => (
            <View key={tpl.id}>
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/cycle/new', params: { template: tpl.id } } as any)
                }
                accessibilityRole="button"
                style={{ paddingVertical: 18, gap: 10 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: ed.fraunces('Fraunces_400Regular'),
                      fontSize: 19,
                      letterSpacing: -0.3,
                      color: ed.colors.ink1,
                    }}
                  >
                    {tpl.name}
                  </Text>
                  <Text
                    style={{
                      fontFamily: ed.typography.labelSm.fontFamily,
                      fontSize: ed.typography.labelSm.fontSize,
                      letterSpacing: ed.typography.labelSm.letterSpacing,
                      color: ed.colors.brand,
                      textTransform: 'uppercase',
                    }}
                  >
                    {tpl.goal}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: ed.typography.bodySm.fontFamily,
                    fontSize: ed.typography.bodySm.fontSize,
                    lineHeight: ed.typography.bodySm.lineHeight,
                    color: ed.colors.ink2,
                  }}
                >
                  {tpl.desc}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {tpl.peptides.map((pid) => {
                    const p = findPeptide(pid);
                    if (!p) return null;
                    return (
                      <View
                        key={pid}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderWidth: 1,
                          borderColor: ed.colors.lineStrong,
                        }}
                      >
                        <View
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 3,
                            backgroundColor: p.color,
                          }}
                        />
                        <Text
                          style={{
                            fontFamily: ed.typography.labelSm.fontFamily,
                            fontSize: ed.typography.labelSm.fontSize,
                            letterSpacing: ed.typography.labelSm.letterSpacing,
                            color: ed.colors.ink2,
                            textTransform: 'uppercase',
                          }}
                        >
                          {p.name}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Pressable>
              {idx < TEMPLATES.length - 1 ? <HairlineRow /> : null}
            </View>
          ))}
        </View>
      </View>

      {/* Saved stacks */}
      {stacks.length > 0 ? (
        <View style={{ marginTop: 36, paddingHorizontal: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <EyebrowLabel withRule>{`Your stacks · ${stacks.length}`}</EyebrowLabel>
            <Pressable onPress={() => router.push('/stack/new' as any)} hitSlop={8}>
              <Text
                style={{
                  fontFamily: ed.typography.label.fontFamily,
                  fontSize: ed.typography.label.fontSize,
                  letterSpacing: ed.typography.label.letterSpacing,
                  color: ed.colors.brand,
                  textTransform: 'uppercase',
                  marginLeft: 12,
                }}
              >
                + New
              </Text>
            </Pressable>
          </View>
          <View style={{ marginTop: 4 }}>
            {stacks.map((s, idx) => {
              const items = JSON.parse(s.items_json) as { peptide_id: string }[];
              return (
                <View key={s.id}>
                  <Pressable
                    onPress={() => router.push(`/stack/${s.id}` as any)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 18,
                      gap: 14,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: ed.fraunces('Fraunces_400Regular'),
                          fontSize: 19,
                          letterSpacing: -0.3,
                          color: ed.colors.ink1,
                        }}
                      >
                        {s.name}
                      </Text>
                      <Text
                        style={{
                          marginTop: 4,
                          fontFamily: ed.typography.labelSm.fontFamily,
                          fontSize: ed.typography.labelSm.fontSize,
                          letterSpacing: ed.typography.labelSm.letterSpacing,
                          color: ed.colors.ink3,
                          textTransform: 'uppercase',
                        }}
                      >
                        {items.length} peptide{items.length === 1 ? '' : 's'}
                        {s.goal ? ` · ${s.goal}` : ''}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontFamily: ed.fraunces('Fraunces_300Light'),
                        fontSize: 22,
                        color: ed.colors.ink3,
                      }}
                    >
                      →
                    </Text>
                  </Pressable>
                  {idx < stacks.length - 1 ? <HairlineRow /> : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Past cycles */}
      {past.length > 0 ? (
        <View style={{ marginTop: 36, paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>{`Past cycles · ${past.length}`}</EyebrowLabel>
          <View style={{ marginTop: 4 }}>
            {past.map((c, idx) => {
              const total = daysBetween(new Date(c.starts_on), new Date(c.ends_on));
              return (
                <View key={c.id}>
                  <Pressable
                    onPress={() => router.push(`/cycle/${c.id}` as any)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 18,
                      gap: 14,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: ed.fraunces('Fraunces_400Regular'),
                          fontSize: 17,
                          letterSpacing: -0.3,
                          color: ed.colors.ink2,
                        }}
                      >
                        {c.name}
                      </Text>
                      <Text
                        style={{
                          marginTop: 4,
                          fontFamily: ed.typography.labelSm.fontFamily,
                          fontSize: ed.typography.labelSm.fontSize,
                          letterSpacing: ed.typography.labelSm.letterSpacing,
                          color: ed.colors.ink3,
                          textTransform: 'uppercase',
                        }}
                      >
                        {total} days · {c.status}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontFamily: ed.fraunces('Fraunces_300Light'),
                        fontSize: 22,
                        color: ed.colors.ink3,
                      }}
                    >
                      →
                    </Text>
                  </Pressable>
                  {idx < past.length - 1 ? <HairlineRow /> : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function ActiveCycleHero({ cycle }: { cycle: Cycle }) {
  const ed = useEditorialTheme();
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

  return (
    <Pressable onPress={() => router.push(`/cycle/${cycle.id}` as any)}>
      <View style={{ marginTop: 32, paddingHorizontal: 24 }}>
        <Text
          style={{
            fontFamily: ed.typography.eyebrow.fontFamily,
            fontSize: ed.typography.eyebrow.fontSize,
            letterSpacing: ed.typography.eyebrow.letterSpacing,
            color: ed.colors.brand,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Active cycle · {cycle.phase}
        </Text>
        <Text
          style={{
            fontFamily: ed.fraunces('Fraunces_400Regular'),
            fontSize: 28,
            letterSpacing: -0.6,
            color: ed.colors.ink1,
          }}
        >
          {cycle.name}
        </Text>
      </View>
      <View style={{ alignItems: 'center', marginTop: 24 }}>
        <HeroRing
          value={pct}
          unit="%"
          size={200}
          label={`Day ${day + 1} of ${total}`}
          color="brand"
        />
      </View>
      <View style={{ marginTop: 24, marginHorizontal: 24 }}>
        <HairlineRow strong />
        <StatPair
          cells={[
            { value: day + 1, unit: `/${total}`, label: 'Day' },
            { value: pct, unit: '%', label: 'Progress' },
            { value: Math.max(0, total - day), unit: 'd', label: 'Remaining' },
          ]}
        />
        <HairlineRow strong />
      </View>
      {protocol.length > 0 ? (
        <View style={{ marginTop: 8, paddingHorizontal: 24 }}>
          {protocol.map((row, i) => {
            const p = findPeptide(row.peptide_id);
            return (
              <View key={i}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: p?.color ?? ed.colors.ink3,
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
                    {p?.name ?? row.peptide_id}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <DoseValue
                      mcg={row.dose_mcg}
                      valueStyle={{
                        fontFamily: ed.typography.dataMd.fontFamily,
                        fontSize: ed.typography.dataMd.fontSize,
                        color: ed.colors.ink3,
                      }}
                    />
                    <Text
                      style={{
                        fontFamily: ed.typography.dataMd.fontFamily,
                        fontSize: ed.typography.dataMd.fontSize,
                        color: ed.colors.ink3,
                      }}
                    >
                      · {row.freq}
                    </Text>
                  </View>
                </View>
                {i < protocol.length - 1 ? <HairlineRow /> : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </Pressable>
  );
}
