// Today — spec v2.0 §10. Real data + smart schedule from active cycle +
// tappable dose rows + tappable vial chips with bottom-sheet actions.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconBolt,
  IconBook,
  IconChart,
  IconCheck,
  IconCog,
  IconSyringe,
} from '../../components/Icons';
import { HCard, HSectionHeader, ResearchBanner } from '../../components/Primitives';
import {
  deactivateVial,
  deleteDose,
  deleteVial,
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

type CycleProtocolItem = {
  peptide_id: string;
  dose_mcg: number;
  freq: string;
  time_of_day: string;
};

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

// A protocol item maps to "expected today" based on frequency.
function isScheduledToday(row: CycleProtocolItem, dayOfCycle: number): boolean {
  const f = (row.freq || '').toLowerCase();
  if (f.includes('twice daily') || f.includes('2x daily')) return true;
  if (f.includes('daily') && !f.includes('every other')) return true;
  if (f.includes('every other')) return dayOfCycle % 2 === 0;
  if (f.includes('twice weekly') || f.includes('2x weekly')) return dayOfCycle % 3 === 0;
  if (f.includes('weekly')) return dayOfCycle % 7 === 0;
  if (f.includes('pre-workout')) return true;
  return true;
}

export default function TodayScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();

  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [vials, setVials] = useState<Vial[]>([]);
  const [todayDoses, setTodayDoses] = useState<Dose[]>([]);
  const [doseSheet, setDoseSheet] = useState<Dose | null>(null);
  const [vialSheet, setVialSheet] = useState<Vial | null>(null);

  const refresh = useCallback(async () => {
    const [c, v] = await Promise.all([getActiveCycle(), listActiveVials()]);
    setCycle(c);
    setVials(v);
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const ds = await listDoses({ from: midnight.toISOString(), limit: 40 });
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

  // Today's scheduled protocol rows (with their logged-status)
  const schedule = useMemo(() => {
    if (!cycle || !cycleView) return [];
    try {
      const protocol = JSON.parse(cycle.protocol_json || '[]') as CycleProtocolItem[];
      return protocol
        .filter((row) => isScheduledToday(row, cycleView.day))
        .map((row) => {
          const logged = todayDoses.some((d) => d.peptide_id === row.peptide_id);
          return { ...row, logged };
        });
    } catch {
      return [];
    }
  }, [cycle, cycleView, todayDoses]);

  const onDeleteDose = async (id: string) => {
    await deleteDose(id);
    setDoseSheet(null);
    refresh();
  };

  const onMarkDepleted = async (id: string) => {
    await deactivateVial(id);
    setVialSheet(null);
    refresh();
  };

  const onDeleteVial = async (id: string) => {
    await deleteVial(id);
    setVialSheet(null);
    refresh();
  };

  return (
    <>
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
                fontSize: 26,
                fontFamily: font.sansBold,
                color: t.ink,
                letterSpacing: -0.6,
                marginTop: 4,
                lineHeight: 30,
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

        {/* Research-only banner */}
        <View style={{ marginHorizontal: space.xl, marginTop: space.md, borderRadius: radius.md, overflow: 'hidden' }}>
          <ResearchBanner compact />
        </View>

        {/* Cycle card */}
        {cycle && cycleView ? (
          <View style={{ paddingHorizontal: space.xl, marginTop: space.md }}>
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
                  {cycleView.pct}% · {cycleView.remaining}d left
                </Text>
              </View>
            </Pressable>
          </View>
        ) : (
          <View style={{ paddingHorizontal: space.xl, marginTop: space.md }}>
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
                Start a cycle to see your protocol here each day, or log individual doses without a cycle.
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

        {/* Today's schedule from cycle protocol */}
        {schedule.length > 0 ? (
          <>
            <HSectionHeader title="Today's schedule" />
            <View style={{ paddingHorizontal: space.xl, gap: 8 }}>
              {schedule.map((row, idx) => {
                const p = findPeptide(row.peptide_id);
                if (!p) return null;
                return (
                  <View
                    key={`${row.peptide_id}-${idx}`}
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
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        backgroundColor: p.color + '24',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {row.logged ? (
                        <IconCheck size={14} color={p.color} />
                      ) : (
                        <IconSyringe size={16} color={p.color} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontFamily: font.sansSemi, color: t.ink }}>
                        {p.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: t.ink3,
                          fontFamily: font.mono,
                          marginTop: 2,
                        }}
                      >
                        {row.dose_mcg} mcg · {row.freq} · {row.time_of_day}
                      </Text>
                    </View>
                    {row.logged ? (
                      <Text
                        style={{
                          fontSize: 11,
                          color: t.success,
                          fontFamily: font.sansSemi,
                          letterSpacing: 0.5,
                        }}
                      >
                        LOGGED
                      </Text>
                    ) : (
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: '/log-dose',
                            params: { peptideId: p.id, prefillDoseMcg: row.dose_mcg },
                          } as any)
                        }
                        style={{
                          backgroundColor: t.ink,
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          borderRadius: radius.pill,
                        }}
                      >
                        <Text style={{ color: t.bg, fontSize: 12, fontFamily: font.sansSemi }}>
                          Log
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {/* Today's logged doses — tappable */}
        {todayDoses.length > 0 ? (
          <>
            <HSectionHeader title="Today's log" />
            <View style={{ paddingHorizontal: space.xl, gap: 8 }}>
              {todayDoses.map((d) => {
                const p = findPeptide(d.peptide_id);
                return (
                  <Pressable
                    key={d.id}
                    onPress={() => setDoseSheet(d)}
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
                    <Text style={{ color: t.ink4, fontSize: 11 }}>Tap</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {/* Active vials — tappable */}
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
                  <Pressable
                    key={v.id}
                    onPress={() => setVialSheet(v)}
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
                  </Pressable>
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
      </ScrollView>

      {/* Dose bottom sheet */}
      <Modal
        visible={!!doseSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setDoseSheet(null)}
      >
        <Pressable
          onPress={() => setDoseSheet(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: t.surface,
              paddingTop: space.lg,
              paddingBottom: insets.bottom + space.lg,
              paddingHorizontal: space.xl,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              gap: 8,
            }}
          >
            {doseSheet ? (
              <>
                <Text style={{ fontSize: 17, fontFamily: font.sansSemi, color: t.ink }}>
                  {findPeptide(doseSheet.peptide_id)?.name ?? doseSheet.peptide_id}
                </Text>
                <Text style={{ fontSize: 13, color: t.ink3, fontFamily: font.mono, marginBottom: space.md }}>
                  {doseSheet.amount_mcg} mcg · {doseSheet.route} ·{' '}
                  {new Date(doseSheet.taken_at).toLocaleString()}
                </Text>
                <Pressable
                  onPress={() => {
                    setDoseSheet(null);
                    router.push({
                      pathname: '/log-dose',
                      params: { peptideId: doseSheet.peptide_id, prefillDoseMcg: doseSheet.amount_mcg },
                    } as any);
                  }}
                  style={{
                    padding: space.md,
                    borderRadius: radius.md,
                    backgroundColor: t.ink,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: t.bg, fontSize: 14, fontFamily: font.sansSemi }}>
                    Edit / re-log
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onDeleteDose(doseSheet.id)}
                  style={{
                    padding: space.md,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: t.danger,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: t.danger, fontSize: 14, fontFamily: font.sansSemi }}>
                    Delete dose (restores vial)
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setDoseSheet(null)}
                  style={{ padding: space.md, alignItems: 'center' }}
                >
                  <Text style={{ color: t.ink3, fontSize: 14 }}>Cancel</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Vial bottom sheet */}
      <Modal
        visible={!!vialSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setVialSheet(null)}
      >
        <Pressable
          onPress={() => setVialSheet(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: t.surface,
              paddingTop: space.lg,
              paddingBottom: insets.bottom + space.lg,
              paddingHorizontal: space.xl,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              gap: 8,
            }}
          >
            {vialSheet ? (
              <>
                <Text style={{ fontSize: 17, fontFamily: font.sansSemi, color: t.ink }}>
                  {findPeptide(vialSheet.peptide_id)?.name ?? vialSheet.peptide_id} vial
                </Text>
                <Text style={{ fontSize: 13, color: t.ink3, fontFamily: font.mono, marginBottom: space.md }}>
                  {vialSheet.remaining_mg.toFixed(2)} / {vialSheet.strength_mg} mg ·{' '}
                  {vialSheet.concentration.toFixed(2)} mg/mL
                </Text>
                <Pressable
                  onPress={() => {
                    setVialSheet(null);
                    router.push({
                      pathname: '/log-dose',
                      params: { peptideId: vialSheet.peptide_id },
                    } as any);
                  }}
                  style={{
                    padding: space.md,
                    borderRadius: radius.md,
                    backgroundColor: t.ink,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: t.bg, fontSize: 14, fontFamily: font.sansSemi }}>
                    Log a dose from this vial
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onMarkDepleted(vialSheet.id)}
                  style={{
                    padding: space.md,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: t.lineStrong,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: t.ink, fontSize: 14, fontFamily: font.sansSemi }}>
                    Mark depleted
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onDeleteVial(vialSheet.id)}
                  style={{
                    padding: space.md,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: t.danger,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: t.danger, fontSize: 14, fontFamily: font.sansSemi }}>
                    Delete vial
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setVialSheet(null)}
                  style={{ padding: space.md, alignItems: 'center' }}
                >
                  <Text style={{ color: t.ink3, fontSize: 14 }}>Cancel</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
