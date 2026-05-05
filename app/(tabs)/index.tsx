// Today — editorial v1 visual rebuild. Data layer + modals untouched
// from the v1.2 implementation; only the scroll content is rebuilt with
// the editorial primitives (hero ring, mini dial row, schedule items,
// stat pair, eyebrow rules).
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DataRow } from '../../components/editorial/DataRow';
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { EditorialSheet, SheetHeader } from '../../components/editorial/EditorialSheet';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { HairlineRow } from '../../components/editorial/HairlineRow';
import { HeroRing } from '../../components/editorial/HeroRing';
import { MiniDial } from '../../components/editorial/MiniDial';
import { ScheduleItem, type ScheduleStatus } from '../../components/editorial/ScheduleItem';
import { StatPair } from '../../components/editorial/StatPair';
import { useEditorialTheme } from '../../lib/design/theme';
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
import { isItemScheduledOnDay, resolvePhase } from '../../lib/cycle-helpers';
import { haptic } from '../../lib/haptics';
import { findPeptide } from '../../lib/peptides';
import { useDoseUnitPref, useProfile } from '../../lib/profile-context';
import { formatDoseLabel } from '../../lib/dose-format';

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
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function timeLabelForWindow(time_of_day: string, window: 'AM' | 'PM' | 'ALL'): string {
  if (window === 'AM') return 'AM';
  if (window === 'PM') return 'PM';
  // Use the protocol-supplied label as-is when not split into AM/PM.
  // Common values: 'morning', 'evening', 'pre-workout', 'anytime'.
  const upper = time_of_day.trim().toUpperCase();
  if (upper.length <= 4) return upper;
  if (upper.startsWith('MORN')) return 'AM';
  if (upper.startsWith('EVE') || upper.startsWith('NIGHT')) return 'PM';
  if (upper.startsWith('PRE')) return 'PRE';
  if (upper.startsWith('POST')) return 'POST';
  return upper.slice(0, 4);
}

function isScheduledToday(row: CycleProtocolItem, dayOfCycle: number): boolean {
  return isItemScheduledOnDay(row, dayOfCycle);
}

export default function TodayScreen() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { pref: doseUnitPref } = useDoseUnitPref();

  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [vials, setVials] = useState<Vial[]>([]);
  const [todayDoses, setTodayDoses] = useState<Dose[]>([]);
  const [todaySkips, setTodaySkips] = useState<DoseSkip[]>([]);
  const [doseSheet, setDoseSheet] = useState<Dose | null>(null);
  const [vialSheet, setVialSheet] = useState<Vial | null>(null);
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
    const dayOfCycle = Math.min(total, Math.max(0, daysBetween(start, today)));
    const displayDay = Math.min(total, dayOfCycle + 1);
    const pct = Math.round((dayOfCycle / total) * 100);
    return { day: dayOfCycle, displayDay, total, pct, remaining: total - dayOfCycle };
  }, [cycle]);

  // Today's scheduled protocol rows. Twice-daily items split into AM + PM
  // rows so each half can be independently logged.
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
        resolvedDose: number;
        resolvedFreq: string;
        phaseCaption?: string;
      })[] = [];
      for (const row of matching) {
        // resolvePhase picks the active phase's freq + dose so phased
        // ramps (Tesa daily→5-on/2-off, Sema titration) display the
        // right values without re-implementing the math here.
        const rp = resolvePhase(row, cycleView.day);
        const activeFreq = rp.freq.toLowerCase();
        const isTwice = activeFreq.includes('twice daily') || activeFreq.includes('2x daily');
        const phaseCaption =
          rp.phaseCount > 1
            ? `${(rp.phaseName ?? `Phase ${rp.phaseIndex + 1}`).toUpperCase()} · WK ${rp.weekInPhase} / ${
                Number.isFinite(rp.totalPhaseWeeks) ? rp.totalPhaseWeeks : '∞'
              }`
            : undefined;
        const base = { resolvedDose: rp.dose_mcg, resolvedFreq: rp.freq, phaseCaption };
        if (isTwice) {
          const amLogged = todayDoses.some(
            (d) => d.peptide_id === row.peptide_id && new Date(d.taken_at).getHours() < 12
          );
          const pmLogged = todayDoses.some(
            (d) => d.peptide_id === row.peptide_id && new Date(d.taken_at).getHours() >= 12
          );
          out.push({ ...row, logged: amLogged, skip: skipFor(row.peptide_id, 'AM'), window: 'AM', ...base });
          out.push({ ...row, logged: pmLogged, skip: skipFor(row.peptide_id, 'PM'), window: 'PM', ...base });
        } else {
          const logged = todayDoses.some((d) => d.peptide_id === row.peptide_id);
          out.push({ ...row, logged, skip: skipFor(row.peptide_id, 'ALL'), window: 'ALL', ...base });
        }
      }
      return out;
    } catch {
      return [];
    }
  }, [cycle, cycleView, todayDoses, todaySkips]);

  // Compliance %: doses logged / scheduled. Drives the hero ring.
  const compliance = useMemo(() => {
    if (schedule.length === 0) return { pct: 0, logged: 0, total: 0 };
    const logged = schedule.filter((r) => r.logged).length;
    const skipped = schedule.filter((r) => !!r.skip && !r.logged).length;
    const denom = schedule.length;
    // Skipped rows count against the denominator but not as "logged".
    return {
      pct: Math.round((logged / Math.max(1, denom)) * 100),
      logged,
      skipped,
      total: denom,
    };
  }, [schedule]);

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

  // Tap behavior: unfinished row → log; logged row → dose sheet; skipped → un-skip.
  // Long-press unfinished row → skip sheet.
  const onScheduleRowPress = (row: (typeof schedule)[number]) => {
    if (row.skip && !row.logged) {
      const p = findPeptide(row.peptide_id);
      unskipRow(row.skip, p?.name ?? row.peptide_id);
      return;
    }
    if (row.logged) {
      const dose = todayDoses.find(
        (d) =>
          d.peptide_id === row.peptide_id &&
          (row.window === 'AM'
            ? new Date(d.taken_at).getHours() < 12
            : row.window === 'PM'
            ? new Date(d.taken_at).getHours() >= 12
            : true)
      );
      if (dose) setDoseSheet(dose);
      return;
    }
    router.push({
      pathname: '/log-dose',
      params: { peptideId: row.peptide_id, prefillDoseMcg: row.resolvedDose },
    } as any);
  };

  const onScheduleRowLongPress = (row: (typeof schedule)[number]) => {
    if (row.logged || row.skip) return;
    const p = findPeptide(row.peptide_id);
    if (!p) return;
    openSkipSheet(p.id, p.name, row.window);
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: ed.colors.bg }}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — eyebrow date + serif greeting + ···· settings */}
        <View
          style={{
            paddingHorizontal: 24,
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
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
              {formatHeaderDate(new Date())}
            </Text>
            <EditorialHeadline size="title1">
              {`${greet(new Date())}, *${displayName}*.`}
            </EditorialHeadline>
          </View>
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            hitSlop={10}
            style={{ paddingTop: 4 }}
          >
            <Text
              style={{
                fontFamily: ed.typography.dataLg.fontFamily,
                fontSize: 24,
                letterSpacing: 4,
                color: ed.colors.ink2,
              }}
            >
              ····
            </Text>
          </Pressable>
        </View>

        {/* Paused-cycle notice — keep visible because it's a critical state.
            Editorial-styled: hairline framed, brass eyebrow, serif body. */}
        {cycle && cycle.status === 'paused' ? (
          <View style={{ marginHorizontal: 24, marginTop: 28 }}>
            <HairlineRow strong />
            <View style={{ paddingVertical: 18, gap: 6 }}>
              <Text
                style={{
                  fontFamily: ed.typography.label.fontFamily,
                  fontSize: ed.typography.label.fontSize,
                  letterSpacing: ed.typography.label.letterSpacing,
                  color: ed.colors.stateWarn,
                  textTransform: 'uppercase',
                }}
              >
                Cycle paused
              </Text>
              <Text
                style={{
                  fontFamily: ed.typography.bodyMd.fontFamily,
                  fontSize: ed.typography.bodyMd.fontSize,
                  lineHeight: ed.typography.bodyMd.lineHeight,
                  color: ed.colors.ink2,
                }}
              >
                {cycle.paused_at
                  ? `Paused since ${new Date(cycle.paused_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}. Resume to continue tracking.`
                  : 'Resume to continue tracking.'}
              </Text>
              <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                <EditorialButton variant="secondary" onPress={onResumeCycle}>
                  Resume cycle
                </EditorialButton>
              </View>
            </View>
            <HairlineRow strong />
          </View>
        ) : null}

        {/* Hero ring — compliance % when there's a schedule, otherwise cycle
            day progress when there's a cycle but nothing scheduled today,
            otherwise a brand-tinted "no cycle" prompt. */}
        <View style={{ alignItems: 'center', marginTop: 36 }}>
          {schedule.length > 0 ? (
            <HeroRing
              value={compliance.pct}
              label={`${compliance.logged} of ${compliance.total} logged`}
              color={
                compliance.pct >= 100
                  ? 'stateOptimal'
                  : compliance.pct >= 50
                  ? 'stateGood'
                  : 'brand'
              }
            />
          ) : cycle && cycleView ? (
            <HeroRing
              value={cycleView.pct}
              unit="%"
              label={`Day ${cycleView.displayDay} of ${cycleView.total}`}
              color="brand"
            />
          ) : (
            <HeroRing value={0} unit="" label="No active cycle" color="brand" />
          )}
        </View>

        {/* No-cycle CTA pair */}
        {!cycle ? (
          <View
            style={{
              marginTop: 32,
              paddingHorizontal: 24,
              flexDirection: 'row',
              gap: 12,
              justifyContent: 'center',
            }}
          >
            <EditorialButton onPress={() => router.push('/cycle/new')}>
              Start a cycle
            </EditorialButton>
            <EditorialButton variant="secondary" onPress={() => router.push('/log-dose')}>
              Log a dose
            </EditorialButton>
          </View>
        ) : null}

        {/* Cycle stats — day / progress / remaining */}
        {cycle && cycleView ? (
          <View style={{ marginTop: 32, marginHorizontal: 24 }}>
            <HairlineRow strong />
            <StatPair
              cells={[
                { value: cycleView.displayDay, unit: `/${cycleView.total}`, label: 'Day' },
                { value: `${cycleView.pct}`, unit: '%', label: 'Progress' },
                { value: cycleView.remaining, unit: 'd', label: 'Remaining' },
              ]}
            />
            <HairlineRow strong />
          </View>
        ) : null}

        {/* Today's schedule */}
        {schedule.length > 0 ? (
          <View style={{ marginTop: 36, paddingHorizontal: 24 }}>
            <EyebrowLabel withRule>Today · Schedule</EyebrowLabel>
            <View style={{ marginTop: 4 }}>
              {schedule.map((row, idx) => {
                const p = findPeptide(row.peptide_id);
                if (!p) return null;
                const status: ScheduleStatus = row.logged
                  ? 'completed'
                  : row.skip
                  ? 'overdue'
                  : 'next';
                const time = timeLabelForWindow(row.time_of_day, row.window);
                const detail = row.skip
                  ? (row.skip.reason ?? 'skipped')
                  : row.resolvedFreq;
                return (
                  <View key={`${row.peptide_id}-${row.window}-${idx}`}>
                    <Pressable
                      onPress={() => onScheduleRowPress(row)}
                      onLongPress={() => onScheduleRowLongPress(row)}
                      delayLongPress={350}
                    >
                      <ScheduleItem
                        time={time}
                        title={p.name}
                        detail={detail}
                        doseMcg={row.resolvedDose}
                        caption={row.phaseCaption}
                        status={
                          // Override label for the skip case — ScheduleItem's
                          // 'overdue' renders the "OVERDUE" word; we want
                          // "SKIPPED" instead. Re-route through 'completed'
                          // visual style with a custom keyword would mean a
                          // wider primitive change, so we keep 'overdue' for
                          // the warn tint and accept the label difference for
                          // now. Real skip→logged distinction is the dim row.
                          status
                        }
                      />
                    </Pressable>
                    {idx < schedule.length - 1 ? <HairlineRow /> : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Today's log — visible when there are doses outside the schedule
            (or all are extra logs not from a protocol). */}
        {todayDoses.length > 0 ? (
          <View style={{ marginTop: 36, paddingHorizontal: 24 }}>
            <EyebrowLabel withRule>Today · Logged</EyebrowLabel>
            <View style={{ marginTop: 4 }}>
              {todayDoses.map((d, idx) => {
                const p = findPeptide(d.peptide_id);
                const time = new Date(d.taken_at)
                  .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                  .replace(' ', '')
                  .toUpperCase();
                return (
                  <View key={d.id}>
                    <Pressable onPress={() => setDoseSheet(d)}>
                      <ScheduleItem
                        time={time}
                        title={p?.name ?? d.peptide_id}
                        detail={`${d.route}${d.site ? ` · ${d.site}` : ''}`}
                        doseMcg={d.amount_mcg}
                        status="completed"
                      />
                    </Pressable>
                    {idx < todayDoses.length - 1 ? <HairlineRow /> : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Active vials — mini dial row. */}
        {vials.length > 0 ? (
          <View style={{ marginTop: 36 }}>
            <View style={{ paddingHorizontal: 24 }}>
              <EyebrowLabel withRule>Active vials</EyebrowLabel>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24, gap: 28, paddingTop: 20 }}
            >
              {vials.map((v) => {
                const p = findPeptide(v.peptide_id);
                const remainingPct = Math.max(
                  0,
                  Math.min(100, Math.round((v.remaining_mg / Math.max(0.0001, v.strength_mg)) * 100))
                );
                const expiresAt = v.expires_at ? new Date(v.expires_at) : null;
                const daysToExpiry = expiresAt
                  ? Math.floor((expiresAt.getTime() - Date.now()) / 864e5)
                  : null;
                const expSoon = daysToExpiry !== null && daysToExpiry <= 3;
                const color = expSoon
                  ? 'stateWarn'
                  : remainingPct < 20
                  ? 'stateLow'
                  : remainingPct < 50
                  ? 'stateModerate'
                  : 'stateGood';
                return (
                  <Pressable key={v.id} onPress={() => setVialSheet(v)}>
                    <MiniDial
                      value={remainingPct}
                      unit="%"
                      color={color}
                      label={p?.name ?? v.peptide_id}
                      size={64}
                    />
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => router.push('/vials' as any)}
                accessibilityRole="button"
                accessibilityLabel="Open all vials"
                style={{ alignItems: 'center', justifyContent: 'center', minWidth: 64 }}
              >
                <View
                  style={{
                    width: 64,
                    height: 64,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: ed.colors.line,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: ed.fraunces('Fraunces_300Light'),
                      fontSize: 28,
                      color: ed.colors.ink2,
                    }}
                  >
                    →
                  </Text>
                </View>
                <Text
                  style={{
                    marginTop: 14,
                    fontFamily: ed.typography.labelSm.fontFamily,
                    fontSize: ed.typography.labelSm.fontSize,
                    letterSpacing: ed.typography.labelSm.letterSpacing,
                    color: ed.colors.ink3,
                    textTransform: 'uppercase',
                  }}
                >
                  All vials
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        ) : null}

        {/* Quick actions — list-style DataRows in editorial language. */}
        <View style={{ marginTop: 40, paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>Quick actions</EyebrowLabel>
          <HairlineRow />
          <DataRow label="Reconstitute" value="" onPress={() => router.push('/reconstitute')} />
          <HairlineRow />
          <DataRow
            label="Site rotation"
            value=""
            onPress={() => router.push('/injection-sites')}
          />
          <HairlineRow />
          <DataRow label="Journal entry" value="" onPress={() => router.push('/journal-entry')} />
          <HairlineRow />
          <DataRow label="Log metric" value="" onPress={() => router.push('/log-metric')} />
          <HairlineRow />
        </View>
      </ScrollView>

      {/* Dose action sheet */}
      <EditorialSheet visible={!!doseSheet} onClose={() => setDoseSheet(null)}>
        {doseSheet ? (
          <>
            <SheetHeader
              title={findPeptide(doseSheet.peptide_id)?.name ?? doseSheet.peptide_id}
              detail={`${formatDoseLabel(doseSheet.amount_mcg, doseUnitPref)} · ${doseSheet.route} · ${new Date(
                doseSheet.taken_at
              ).toLocaleString()}`}
            />
            <View style={{ marginTop: 18, gap: 12 }}>
              <EditorialButton
                fullWidth
                onPress={() => {
                  setDoseSheet(null);
                  router.push({
                    pathname: '/log-dose',
                    params: {
                      peptideId: doseSheet.peptide_id,
                      prefillDoseMcg: doseSheet.amount_mcg,
                    },
                  } as any);
                }}
              >
                Log another
              </EditorialButton>
              <EditorialButton
                variant="secondary"
                fullWidth
                onPress={() => onDeleteDose(doseSheet.id)}
              >
                Delete dose (restores vial)
              </EditorialButton>
              <EditorialButton variant="secondary" fullWidth onPress={() => setDoseSheet(null)}>
                Cancel
              </EditorialButton>
            </View>
          </>
        ) : null}
      </EditorialSheet>

      {/* Vial action sheet */}
      <EditorialSheet visible={!!vialSheet} onClose={() => setVialSheet(null)}>
        {vialSheet ? (
          <>
            <SheetHeader
              title={`${findPeptide(vialSheet.peptide_id)?.name ?? vialSheet.peptide_id} vial`}
              detail={`${vialSheet.remaining_mg.toFixed(2)} / ${vialSheet.strength_mg} mg · ${vialSheet.concentration.toFixed(
                2
              )} mg/mL`}
            />
            <View style={{ marginTop: 18, gap: 12 }}>
              <EditorialButton
                fullWidth
                onPress={() => {
                  setVialSheet(null);
                  router.push({
                    pathname: '/log-dose',
                    params: { peptideId: vialSheet.peptide_id },
                  } as any);
                }}
              >
                Log a dose from this vial
              </EditorialButton>
              <EditorialButton
                variant="secondary"
                fullWidth
                onPress={() => onMarkDepleted(vialSheet.id)}
              >
                Mark depleted
              </EditorialButton>
              <EditorialButton
                variant="secondary"
                fullWidth
                onPress={() => onDeleteVial(vialSheet.id)}
              >
                Delete vial
              </EditorialButton>
              <EditorialButton variant="secondary" fullWidth onPress={() => setVialSheet(null)}>
                Cancel
              </EditorialButton>
            </View>
          </>
        ) : null}
      </EditorialSheet>

      {/* Skip sheet */}
      <EditorialSheet visible={!!skipSheet} onClose={() => setSkipSheet(null)}>
        {skipSheet ? (
          <>
            <Text
              style={{
                fontFamily: ed.typography.eyebrow.fontFamily,
                fontSize: ed.typography.eyebrow.fontSize,
                letterSpacing: ed.typography.eyebrow.letterSpacing,
                color: ed.colors.ink3,
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              Skip · {skipSheet.window !== 'ALL' ? skipSheet.window : 'today'}
            </Text>
            <Text
              style={{
                fontFamily: ed.fraunces('Fraunces_400Regular'),
                fontSize: 24,
                lineHeight: 30,
                letterSpacing: -0.4,
                color: ed.colors.ink1,
              }}
            >
              Why skip{' '}
              <Text style={{ fontFamily: ed.fraunces('Fraunces_400Regular_Italic') }}>
                {skipSheet.peptideName}
              </Text>
              ?
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 18 }}>
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
                      paddingHorizontal: 14,
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
              placeholderTextColor={ed.colors.ink4}
              multiline
              maxLength={300}
              selectionColor={ed.colors.brand}
              style={{
                marginTop: 14,
                paddingVertical: 14,
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: ed.colors.line,
                fontFamily: ed.fraunces('Fraunces_400Regular'),
                fontSize: 16,
                lineHeight: 24,
                color: ed.colors.ink1,
                minHeight: 60,
                textAlignVertical: 'top',
              }}
            />
            <View style={{ marginTop: 18, gap: 12 }}>
              <EditorialButton fullWidth onPress={confirmSkip}>
                Confirm skip
              </EditorialButton>
              <EditorialButton variant="secondary" fullWidth onPress={() => setSkipSheet(null)}>
                Cancel
              </EditorialButton>
            </View>
          </>
        ) : null}
      </EditorialSheet>
    </>
  );
}
