// Today — spec v2.0 §10 "Today — home". Real data, no mocks.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconBolt,
  IconBook,
  IconChart,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconCog,
  IconSyringe,
} from '../../components/Icons';
import { HCard, HSectionHeader } from '../../components/Primitives';
import {
  getActiveCycle,
  listActiveVials,
  listDoses,
  type Cycle,
  type Dose,
  type Vial,
} from '../../lib/db';
import { findPeptide } from '../../lib/peptides';
import { useProfile } from '../../lib/profile-context';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

function formatHeaderDate(d: Date) {
  return d
    .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    .toUpperCase()
    .replace(',', ' ·');
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 864e5);
}

function greet(d: Date) {
  const h = d.getHours();
  if (h < 5) return 'Late night,';
  if (h < 12) return 'Good morning,';
  if (h < 18) return 'Good afternoon,';
  return 'Good evening,';
}

export default function TodayScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();

  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [vials, setVials] = useState<Vial[]>([]);
  const [todayDoses, setTodayDoses] = useState<Dose[]>([]);

  const refresh = useCallback(async () => {
    const [c, v] = await Promise.all([getActiveCycle(), listActiveVials()]);
    setCycle(c);
    setVials(v);
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const ds = await listDoses({ from: midnight.toISOString(), limit: 20 });
    setTodayDoses(ds);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const displayName = profile?.display_name?.trim() || 'there';

  const cycleView = useMemo(() => {
    if (!cycle) return null;
    const start = new Date(cycle.starts_on);
    const end = new Date(cycle.ends_on);
    const today = new Date();
    const total = Math.max(1, daysBetween(start, end));
    const day = Math.min(total, Math.max(0, daysBetween(start, today)));
    const pct = Math.round((day / total) * 100);
    return { day, total, pct, remaining: total - day };
  }, [cycle]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + space.md,
        paddingBottom: 140,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View
        style={{
          paddingHorizontal: space.xl,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 11,
              color: t.ink3,
              letterSpacing: 1.2,
              fontFamily: font.sansSemi,
            }}
          >
            {formatHeaderDate(new Date())}
          </Text>
          <Text
            style={{
              fontSize: 28,
              fontFamily: font.sansBold,
              color: t.ink,
              letterSpacing: -0.6,
              marginTop: 4,
              lineHeight: 32,
            }}
          >
            {greet(new Date())} {displayName}.
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/settings')}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: t.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          hitSlop={6}
        >
          <IconCog size={18} color={t.ink2} />
        </Pressable>
      </View>

      {/* Cycle + scheduled doses */}
      {cycle && cycleView ? (
        <>
          <View style={{ paddingHorizontal: space.xl, marginTop: space.lg }}>
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
                      color: t.ink3,
                      textTransform: 'uppercase',
                    }}
                  >
                    Active cycle
                  </Text>
                  <Text style={{ fontSize: 17, fontFamily: font.sansSemi, color: t.ink, marginTop: 2 }}>
                    {cycle.name}
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    backgroundColor: t.accentSoft,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
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
              <View style={{ flexDirection: 'row', gap: 2, marginBottom: space.sm }}>
                {Array.from({ length: Math.min(cycleView.total, 56) }).map((_, i) => {
                  const scaledI = Math.floor((i * cycleView.total) / Math.min(cycleView.total, 56));
                  return (
                    <View
                      key={i}
                      style={{
                        flex: 1,
                        height: 16,
                        borderRadius: 2,
                        backgroundColor: scaledI < cycleView.day ? t.accent : t.surfaceAlt,
                        opacity: scaledI < cycleView.day ? 0.55 + i / 100 : 1,
                      }}
                    />
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: t.ink2, fontSize: 13, fontFamily: font.mono }}>
                  Day {cycleView.day} / {cycleView.total}
                </Text>
                <Text style={{ color: t.ink3, fontSize: 13, fontFamily: font.mono }}>
                  {cycleView.pct}% complete · {cycleView.remaining}d left
                </Text>
              </View>
            </Pressable>
          </View>
        </>
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
                marginBottom: space.sm,
              }}
            >
              No active cycle
            </Text>
            <Text style={{ fontSize: 15, color: t.ink2, lineHeight: 22, marginBottom: space.md }}>
              Start a cycle to see your protocol here each day, or log individual doses
              without a cycle.
            </Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Pressable
                onPress={() => router.push('/cycle/new')}
                style={{
                  flex: 1,
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
              <Pressable
                onPress={() => router.push('/log-dose')}
                style={{
                  flex: 1,
                  padding: space.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: t.lineStrong,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: t.ink, fontSize: 14, fontFamily: font.sansSemi }}>
                  Log a dose
                </Text>
              </Pressable>
            </View>
          </HCard>
        </View>
      )}

      {/* Today's doses */}
      {todayDoses.length > 0 ? (
        <>
          <HSectionHeader title="Today" />
          <View style={{ paddingHorizontal: space.xl, gap: 8 }}>
            {todayDoses.map((d) => {
              const p = findPeptide(d.peptide_id);
              return (
                <View
                  key={d.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                    backgroundColor: t.surface,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: t.line,
                    padding: space.md,
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: (p?.color ?? t.accent) + '24',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IconCheck size={14} color={p?.color ?? t.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: font.sansSemi, color: t.ink }}>
                      {p?.name ?? d.peptide_id}
                    </Text>
                    <Text style={{ fontSize: 12, color: t.ink3, fontFamily: font.mono, marginTop: 2 }}>
                      {d.amount_mcg} mcg · {d.route}
                      {d.site ? ` · ${d.site}` : ''} ·{' '}
                      {new Date(d.taken_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      {/* Active vials */}
      {vials.length > 0 ? (
        <>
          <HSectionHeader title="Active vials" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: space.xl, gap: 10 }}
          >
            {vials.map((v) => {
              const p = findPeptide(v.peptide_id);
              const remainingPct = Math.round((v.remaining_mg / v.strength_mg) * 100);
              const expiresAt = v.expires_at ? new Date(v.expires_at) : null;
              const daysToExpiry = expiresAt
                ? Math.floor((expiresAt.getTime() - Date.now()) / 864e5)
                : null;
              const expSoon = daysToExpiry !== null && daysToExpiry <= 3;
              return (
                <View
                  key={v.id}
                  style={{
                    minWidth: 200,
                    backgroundColor: t.surface,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: t.line,
                    padding: space.md,
                    gap: space.sm,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: p?.color ?? t.accent,
                      }}
                    />
                    <Text style={{ fontSize: 14, fontFamily: font.sansSemi, color: t.ink }}>
                      {p?.name ?? v.peptide_id}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 20, fontFamily: font.monoSemi, color: t.ink }}>
                    {v.remaining_mg.toFixed(2)}
                    <Text style={{ fontSize: 12, color: t.ink3, fontFamily: font.sansMed }}>
                      {' '}
                      / {v.strength_mg} mg
                    </Text>
                  </Text>
                  <View style={{ height: 4, backgroundColor: t.surfaceAlt, borderRadius: 2 }}>
                    <View
                      style={{
                        width: `${Math.max(2, remainingPct)}%`,
                        height: 4,
                        backgroundColor: remainingPct < 20 ? t.warn : t.accent,
                        borderRadius: 2,
                      }}
                    />
                  </View>
                  {daysToExpiry !== null ? (
                    <Text
                      style={{
                        fontSize: 11,
                        color: expSoon ? t.warn : t.ink3,
                        fontFamily: font.sansMed,
                      }}
                    >
                      {daysToExpiry <= 0
                        ? 'Expired'
                        : daysToExpiry === 1
                          ? 'Expires tomorrow'
                          : `${daysToExpiry} days left`}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      {/* Quick actions */}
      <HSectionHeader title="Quick actions" />
      <View
        style={{
          paddingHorizontal: space.xl,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        {[
          {
            label: 'Reconstitute',
            sub: 'Set up a new vial',
            Icon: IconBolt,
            onPress: () => router.push('/reconstitute'),
          },
          {
            label: 'Site rotation',
            sub: 'Pick next injection site',
            Icon: IconSyringe,
            onPress: () => router.push('/injection-sites'),
          },
          {
            label: 'Journal entry',
            sub: 'How do you feel?',
            Icon: IconBook,
            onPress: () => router.push('/journal-entry'),
          },
          {
            label: 'Log metric',
            sub: 'Weight, HR, sleep, labs',
            Icon: IconChart,
            onPress: () => router.push('/log-metric'),
          },
        ].map((q) => (
          <Pressable
            key={q.label}
            onPress={q.onPress}
            style={{
              width: '48.5%',
              backgroundColor: t.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.line,
              padding: space.md,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: t.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: space.sm,
              }}
            >
              <q.Icon size={16} color={t.ink2} />
            </View>
            <Text style={{ fontSize: 14, fontFamily: font.sansSemi, color: t.ink }}>
              {q.label}
            </Text>
            <Text style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>{q.sub}</Text>
          </Pressable>
        ))}
      </View>

      {/* Disclaimer footer */}
      <View
        style={{
          marginTop: space.xl,
          marginHorizontal: space.xl,
          padding: space.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: t.warn + '40',
          backgroundColor: t.warnSoft + '60',
        }}
      >
        <Text style={{ color: t.ink2, fontSize: 12, lineHeight: 18 }}>
          Helix is an educational / research tracking tool. Not medical advice.
          Dosing ranges in the Library reflect published research protocols and are
          not recommendations.
        </Text>
      </View>
    </ScrollView>
  );
}
