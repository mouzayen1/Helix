// Today — spec v2.0 §10. Real data + smart schedule from active cycle +
// tappable dose rows + tappable vial chips with bottom-sheet actions.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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
  createDoseSkip,
  deactivateVial,
  deleteDose,
  deleteDoseSkip,
  deleteVial,
  getActiveCycle,
  listActiveVials,
  listDoseSkips,
  listDoses,
  resumeCycle,
  type Cycle,
  type Dose,
  type DoseSkip,
  type Vial,
} from '../../lib/db';
import { haptic } from '../../lib/haptics';
import { getPeptideExtras } from '../../lib/peptide-extras';
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

// Given a peptide with a multi-phase cycleTemplate, determine which phase
// the user is currently in based on days-since-cycle-start. Returns null
// if the peptide has no phase structure.
//
// Edge cases:
//   - dayOfCycle = 0 (cycle just started) → returns phase 1, week 1.
//   - dayOfCycle past the sum of phase weeks → returns the LAST phase with
//     extended=true, so the UI can render 'Past <name>' instead of a
//     frozen 'week X of X' that implies they're still in it.
//   - Phases with zero weeks are skipped automatically.
function currentPhaseFor(
  peptide_id: string,
  dayOfCycle: number
): {
  name: string;
  weekInPhase: number;
  totalWeeks: number;
  doseModifier?: string;
  extended: boolean;
  weeksPastEnd?: number;
} | null {
  const extras = getPeptideExtras(peptide_id);
  const phases = extras?.cycleTemplate?.phases;
  if (!phases || phases.length === 0) return null;
  const safeDay = Math.max(0, dayOfCycle);
  const currentWeek = Math.floor(safeDay / 7);
  let cumulative = 0;
  for (const ph of phases) {
    if (ph.weeks <= 0) continue;
    if (currentWeek < cumulative + ph.weeks) {
      return {
        name: ph.name,
        weekInPhase: currentWeek - cumulative + 1,
        totalWeeks: ph.weeks,
        doseModifier: ph.dose_modifier,
        extended: false,
      };
    }
    cumulative += ph.weeks;
  }
  // Past the last non-zero phase — keep the badge visible but flag it
  // so the UI can say "Past maintenance" instead of a frozen week count.
  const last = phases[phases.length - 1];
  return {
    name: last.name,
    weekInPhase: last.weeks,
    totalWeeks: last.weeks,
    doseModifier: last.dose_modifier,
    extended: true,
    weeksPastEnd: Math.max(1, currentWeek - cumulative + 1),
  };
}

// A protocol item maps to "expected today" based on frequency.
// Unknown/pre-workout frequencies default to false (opt-in only).
function isScheduledToday(row: CycleProtocolItem, dayOfCycle: number): boolean {
  const f = (row.freq || '').toLowerCase();
  if (f.includes('twice daily') || f.includes('2x daily')) return true;
  if (f.includes('daily') && !f.includes('every other')) return true;
  if (f.includes('every other')) return dayOfCycle % 2 === 0;
  if (f.includes('twice weekly') || f.includes('2x weekly'))
    return dayOfCycle % 7 === 0 || dayOfCycle % 7 === 3;
  if (f.includes('weekly')) return dayOfCycle % 7 === 0;
  // pre-workout and unknown freqs: do NOT auto-schedule. User logs manually
  // when they actually do the workout.
  return false;
}

export default function TodayScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();

  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [vials, setVials] = useState<Vial[]>([]);
  const [todayDoses, setTodayDoses] = useState<Dose[]>([]);
  const [todaySkips, setTodaySkips] = useState<DoseSkip[]>([]);
  const [doseSheet, setDoseSheet] = useState<Dose | null>(null);
  const [vialSheet, setVialSheet] = useState<Vial | null>(null);
  // Skip sheet — peptide + cycle context for the row being skipped.
  const [skipSheet, setSkipSheet] = useState<{
    peptideId: string;
    peptideName: string;
    window: 'AM' | 'PM' | 'ALL';
  } | null>(null);
  const [skipReason, setSkipReason] = useState<string | null>(null);
  const [skipNote, setSkipNote] = useState('');

  const refresh = useCallback(async () => {
    const [c, v] = await Promise.all([getActiveCycle(), listActiveVials()]);
    setCycle(c);
    setVials(v);
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    const [ds, sk] = await Promise.all([
      listDoses({ from: midnight.toISOString(), limit: 40 }),
      listDoseSkips({ from: iso, to: iso }),
    ]);
    setTodayDoses(ds);
    setTodaySkips(sk);
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
    // dayOfCycle is 0-indexed for schedule math; displayDay is 1-indexed
    // so users see "Day 1 of 30" on the start date, not "Day 0".
    const dayOfCycle = Math.min(total, Math.max(0, daysBetween(start, today)));
    const displayDay = Math.min(total, dayOfCycle + 1);
    const pct = Math.round((dayOfCycle / total) * 100);
    return { day: dayOfCycle, displayDay, total, pct, remaining: total - dayOfCycle };
  }, [cycle]);

  // Today's scheduled protocol rows. Twice-daily items split into AM + PM rows
  // so each half can be independently logged/checked. Skips are matched by
  // (peptide_id, time_of_day) — where time_of_day encodes the window.
  const schedule = useMemo(() => {
    if (!cycle || !cycleView) return [];
    try {
      const protocol = JSON.parse(cycle.protocol_json || '[]') as CycleProtocolItem[];
      const matching = protocol.filter((row) => isScheduledToday(row, cycleView.day));
      const skipFor = (pid: string, win: 'AM' | 'PM' | 'ALL') =>
        todaySkips.find(
          (s) =>
            s.peptide_id === pid &&
            (s.time_of_day === win ||
              (win === 'ALL' && (s.time_of_day === null || s.time_of_day === 'ALL')))
        ) ?? null;
      const out: (CycleProtocolItem & {
        logged: boolean;
        skip: DoseSkip | null;
        window: 'AM' | 'PM' | 'ALL';
      })[] = [];
      for (const row of matching) {
        const isTwice =
          (row.freq || '').toLowerCase().includes('twice daily') ||
          (row.freq || '').toLowerCase().includes('2x daily');
        if (isTwice) {
          const amLogged = todayDoses.some(
            (d) => d.peptide_id === row.peptide_id && new Date(d.taken_at).getHours() < 12
          );
          const pmLogged = todayDoses.some(
            (d) => d.peptide_id === row.peptide_id && new Date(d.taken_at).getHours() >= 12
          );
          out.push({
            ...row,
            logged: amLogged,
            skip: skipFor(row.peptide_id, 'AM'),
            window: 'AM',
          });
          out.push({
            ...row,
            logged: pmLogged,
            skip: skipFor(row.peptide_id, 'PM'),
            window: 'PM',
          });
        } else {
          const logged = todayDoses.some((d) => d.peptide_id === row.peptide_id);
          out.push({
            ...row,
            logged,
            skip: skipFor(row.peptide_id, 'ALL'),
            window: 'ALL',
          });
        }
      }
      return out;
    } catch {
      return [];
    }
  }, [cycle, cycleView, todayDoses, todaySkips]);

  const todayIsoDate = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  }, []);

  const openSkipSheet = (peptideId: string, peptideName: string, window: 'AM' | 'PM' | 'ALL') => {
    setSkipSheet({ peptideId, peptideName, window });
    setSkipReason(null);
    setSkipNote('');
  };

  const confirmSkip = async () => {
    if (!skipSheet) return;
    await createDoseSkip({
      peptide_id: skipSheet.peptideId,
      cycle_id: cycle?.id ?? undefined,
      scheduled_date: todayIsoDate,
      time_of_day: skipSheet.window,
      reason: skipReason ?? undefined,
      note: skipNote.trim() || undefined,
    });
    haptic.warn();
    setSkipSheet(null);
    await refresh();
  };

  const unskipRow = (skip: DoseSkip, peptideName: string) => {
    Alert.alert('Un-skip this dose?', `Remove the skip entry for ${peptideName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Un-skip',
        onPress: async () => {
          await deleteDoseSkip(skip.id);
          await refresh();
        },
      },
    ]);
  };

  const onResumeCycle = async () => {
    if (!cycle) return;
    await resumeCycle(cycle.id);
    haptic.success();
    await refresh();
  };

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
            accessibilityRole="button"
            accessibilityLabel="Open settings"
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

        {/* Paused cycle banner */}
        {cycle && cycle.status === 'paused' ? (
          <View
            style={{
              marginHorizontal: space.xl,
              marginTop: space.md,
              padding: space.md,
              borderRadius: radius.md,
              backgroundColor: t.warnSoft,
              borderWidth: 1,
              borderColor: t.warn + '60',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: t.warn, fontFamily: font.sansSemi, letterSpacing: 0.5 }}>
                CYCLE PAUSED
              </Text>
              <Text style={{ fontSize: 13, color: t.ink2, marginTop: 2 }}>
                {cycle.paused_at
                  ? `Paused since ${new Date(cycle.paused_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}. Resume to continue tracking.`
                  : 'Resume to continue tracking.'}
              </Text>
            </View>
            <Pressable
              onPress={onResumeCycle}
              accessibilityRole="button"
              accessibilityLabel="Resume cycle"
              style={{
                backgroundColor: t.ink,
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: radius.pill,
              }}
            >
              <Text style={{ color: t.bg, fontSize: 12, fontFamily: font.sansSemi }}>Resume</Text>
            </Pressable>
          </View>
        ) : null}

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
                  Day {cycleView.displayDay} / {cycleView.total}
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
                const windowLabel =
                  row.window === 'AM' ? 'Morning' : row.window === 'PM' ? 'Evening' : null;
                const phase = cycleView
                  ? currentPhaseFor(row.peptide_id, cycleView.day)
                  : null;
                const isSkipped = !!row.skip;
                return (
                  <Pressable
                    key={`${row.peptide_id}-${row.window}-${idx}`}
                    onPress={() =>
                      isSkipped && row.skip ? unskipRow(row.skip, p.name) : undefined
                    }
                    disabled={!isSkipped}
                    style={{
                      backgroundColor: isSkipped ? t.surfaceAlt : t.surface,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: t.line,
                      padding: space.md,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.md,
                      opacity: isSkipped ? 0.7 : 1,
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
                        {windowLabel ? (
                          <Text
                            style={{
                              fontSize: 11,
                              color: p.color,
                              fontFamily: font.sansSemi,
                            }}
                          >
                            {' · '}
                            {windowLabel}
                          </Text>
                        ) : null}
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
                      {phase ? (
                        <Text
                          style={{
                            fontSize: 11,
                            color: phase.extended ? t.ink3 : t.accent,
                            fontFamily: font.sansSemi,
                            marginTop: 2,
                            letterSpacing: 0.3,
                          }}
                        >
                          {phase.extended
                            ? `Past ${phase.name.toLowerCase()}${
                                phase.weeksPastEnd && phase.weeksPastEnd > 1
                                  ? ` · week +${phase.weeksPastEnd - 1}`
                                  : ''
                              }`
                            : `${phase.name} · week ${phase.weekInPhase} of ${phase.totalWeeks}`}
                          {phase.doseModifier ? ` · ${phase.doseModifier}` : ''}
                        </Text>
                      ) : null}
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
                    ) : isSkipped ? (
                      <Text
                        style={{
                          fontSize: 11,
                          color: t.ink3,
                          fontFamily: font.sansSemi,
                          letterSpacing: 0.5,
                        }}
                      >
                        SKIPPED
                      </Text>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <Pressable
                          onPress={() => openSkipSheet(p.id, p.name, row.window)}
                          accessibilityRole="button"
                          accessibilityLabel={`Skip ${p.name}`}
                          style={{
                            backgroundColor: t.surface,
                            borderWidth: 1,
                            borderColor: t.line,
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: radius.pill,
                          }}
                        >
                          <Text
                            style={{ color: t.ink3, fontSize: 12, fontFamily: font.sansSemi }}
                          >
                            Skip
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: '/log-dose',
                              params: { peptideId: p.id, prefillDoseMcg: row.dose_mcg },
                            } as any)
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`Log ${p.name}`}
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
                      </View>
                    )}
                  </Pressable>
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

              {/* All vials card — routes to /vials for full library + history */}
              <Pressable
                onPress={() => router.push('/vials' as any)}
                accessibilityRole="button"
                accessibilityLabel="Open all vials"
                style={{
                  minWidth: 160,
                  backgroundColor: t.surfaceAlt,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: t.line,
                  padding: space.md,
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  gap: 6,
                }}
              >
                <Text style={{ fontSize: 13, fontFamily: font.sansSemi, color: t.ink }}>
                  All vials →
                </Text>
                <Text style={{ fontSize: 11, color: t.ink3, fontFamily: font.mono }}>
                  Active + history
                </Text>
              </Pressable>
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
                    Log another
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

      {/* Skip sheet */}
      <Modal
        visible={!!skipSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setSkipSheet(null)}
      >
        <Pressable
          onPress={() => setSkipSheet(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: t.bg,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: space.lg,
              paddingBottom: insets.bottom + space.lg,
              gap: space.md,
            }}
          >
            {skipSheet ? (
              <>
                <Text style={{ fontSize: 18, fontFamily: font.sansBold, color: t.ink }}>
                  Why skip {skipSheet.peptideName}
                  {skipSheet.window !== 'ALL' ? ` (${skipSheet.window})` : ''} today?
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    { key: 'forgot', label: 'Forgot' },
                    { key: 'traveling', label: 'Traveling' },
                    { key: 'side_effect', label: 'Side effect' },
                    { key: 'running_low', label: 'Running low' },
                    { key: 'rest_day', label: 'Rest day' },
                    { key: 'other', label: 'Other' },
                  ].map((r) => {
                    const on = skipReason === r.key;
                    return (
                      <Pressable
                        key={r.key}
                        onPress={() => setSkipReason(r.key)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: radius.pill,
                          backgroundColor: on ? t.ink : t.surface,
                          borderWidth: 1,
                          borderColor: on ? t.ink : t.line,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontFamily: font.sansMed,
                            color: on ? t.bg : t.ink,
                          }}
                        >
                          {r.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  value={skipNote}
                  onChangeText={setSkipNote}
                  placeholder="Optional note"
                  placeholderTextColor={t.ink4}
                  multiline
                  maxLength={300}
                  style={{
                    borderWidth: 1,
                    borderColor: t.line,
                    borderRadius: radius.md,
                    padding: space.md,
                    color: t.ink,
                    fontSize: 14,
                    minHeight: 48,
                    textAlignVertical: 'top',
                  }}
                />
                <Pressable
                  onPress={confirmSkip}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm skip"
                  style={{
                    padding: space.md,
                    borderRadius: radius.md,
                    backgroundColor: t.ink,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: t.bg, fontSize: 14, fontFamily: font.sansSemi }}>
                    Confirm skip
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setSkipSheet(null)}
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
