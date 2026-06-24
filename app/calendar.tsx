// Calendar — a month-grid view of injections at a glance. Past days show
// what was logged (or skipped / missed); today and future show what's
// scheduled. The schedule projection runs through
// getScheduledDosesInRange (cycle-helpers), which reuses the same phase
// resolver + isScheduledOnDay path as the Today screen and the
// notification / OS-calendar schedulers — so this view never re-parses freq.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DoseDetailSheet } from '../components/DoseDetailSheet';
import { EditorialHeadline } from '../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../components/editorial/EyebrowLabel';
import { HairlineRow } from '../components/editorial/HairlineRow';
import { IconChevronLeft, IconChevronRight } from '../components/Icons';
import { useEditorialTheme } from '../lib/design/theme';
import { getScheduledDosesInRange, type ScheduledDose } from '../lib/cycle-helpers';
import {
  getCurrentUserId,
  listActiveCycles,
  listDoseSkips,
  listDoses,
  type Dose,
  type DoseSkip,
} from '../lib/db';
import { formatDoseLabel } from '../lib/dose-format';
import { findPeptide } from '../lib/peptides';
import { useDoseUnitPref } from '../lib/profile-context';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

// Group an array by a date-key getter into a Map<iso, T[]>.
function groupByDate<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const arr = out.get(k);
    if (arr) arr.push(row);
    else out.set(k, [row]);
  }
  return out;
}

type DayStatus = 'logged' | 'skipped' | 'missed' | 'due' | 'upcoming';

export default function CalendarScreen() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pref: doseUnitPref } = useDoseUnitPref();

  const todayIso = useMemo(() => isoLocal(new Date()), []);

  // monthAnchor is always day 1 of the displayed month.
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string>(todayIso);

  const [doses, setDoses] = useState<Dose[]>([]);
  const [skips, setSkips] = useState<DoseSkip[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledDose[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [openDose, setOpenDose] = useState<Dose | null>(null);

  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();

  const refresh = useCallback(async () => {
    if (!getCurrentUserId()) return;
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    // taken_at is stored as toISOString() (UTC, ...Z). Convert the local
    // day-edges to UTC for the comparison — a naive local string would be
    // both offset and format-mismatched against the stored values, dropping
    // late-evening doses on the month's first/last local day. groupByDate
    // below re-derives the local date, so this fetch is exactly right (no
    // widening). Mirrors the Today screen's midnight.toISOString() bound.
    const firstUtc = first.toISOString();
    const lastUtc = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();
    const [d, sk, sched, acs] = await Promise.all([
      listDoses({ from: firstUtc, to: lastUtc, limit: 2000 }),
      listDoseSkips({ from: isoLocal(first), to: isoLocal(last) }),
      getScheduledDosesInRange(first, last),
      listActiveCycles(),
    ]);
    setDoses(d);
    setSkips(sk);
    setScheduled(sched);
    setActiveCount(acs.filter((c) => c.status === 'active').length);
  }, [year, month]);

  // Re-runs on focus and whenever the visible month changes (refresh identity
  // changes with [year, month], so useFocusEffect re-invokes while focused).
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const dosesByDate = useMemo(
    () => groupByDate(doses, (d) => isoLocal(new Date(d.taken_at))),
    [doses]
  );
  const skipsByDate = useMemo(() => groupByDate(skips, (s) => s.scheduled_date), [skips]);
  const scheduledByDate = useMemo(() => groupByDate(scheduled, (s) => s.date), [scheduled]);

  // Build the month grid as weeks of 7 cells; null = leading/trailing blank.
  const weeks = useMemo(() => {
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const lead = first.getDay(); // 0 = Sunday
    const cells: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [year, month]);

  const monthLabel = monthAnchor
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    .toUpperCase();

  const goMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setMonthAnchor(next);
    // Keep the detail panel meaningful for the month now on screen: jump to
    // today if it's the current month, otherwise the 1st.
    const isCurrent = next.getFullYear() === new Date().getFullYear() && next.getMonth() === new Date().getMonth();
    setSelected(isCurrent ? todayIso : isoLocal(next));
  };

  const goToday = () => {
    const n = new Date();
    setMonthAnchor(new Date(n.getFullYear(), n.getMonth(), 1));
    setSelected(todayIso);
  };

  // Dots for a day cell. Priority: logged > skipped > scheduled (upcoming/
  // today outline, past-missed a single faint mark). Capped at 3.
  const dotsFor = (iso: string): { color: string; filled: boolean }[] => {
    const logged = dosesByDate.get(iso) ?? [];
    const sk = skipsByDate.get(iso) ?? [];
    const sched = scheduledByDate.get(iso) ?? [];
    const cap = (n: number) => Math.min(n, 3);
    if (logged.length > 0) {
      return Array.from({ length: cap(logged.length) }, () => ({ color: ed.colors.brand, filled: true }));
    }
    if (sk.length > 0) {
      return Array.from({ length: cap(sk.length) }, () => ({ color: ed.colors.stateWarn, filled: true }));
    }
    if (sched.length > 0) {
      if (iso < todayIso) return [{ color: ed.colors.ink4, filled: false }]; // missed
      return Array.from({ length: cap(sched.length) }, () => ({ color: ed.colors.ink3, filled: false }));
    }
    return [];
  };

  const statusFor = (item: ScheduledDose): DayStatus => {
    const logged = (dosesByDate.get(item.date) ?? []).some((d) => d.peptide_id === item.peptide_id);
    if (logged) return 'logged';
    const skipped = (skipsByDate.get(item.date) ?? []).some((s) => s.peptide_id === item.peptide_id);
    if (skipped) return 'skipped';
    if (item.date < todayIso) return 'missed';
    if (item.date === todayIso) return 'due';
    return 'upcoming';
  };

  const statusMeta: Record<DayStatus, { label: string; color: string }> = {
    logged: { label: 'Logged', color: ed.colors.brand },
    skipped: { label: 'Skipped', color: ed.colors.stateWarn },
    missed: { label: 'Missed', color: ed.colors.ink3 },
    due: { label: 'Due', color: ed.colors.ink1 },
    upcoming: { label: 'Upcoming', color: ed.colors.ink3 },
  };

  const selScheduled = scheduledByDate.get(selected) ?? [];
  const selDoses = dosesByDate.get(selected) ?? [];

  const selectedHeading = useMemo(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(selected);
    const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(selected);
    const rel =
      selected === todayIso
        ? ' · TODAY'
        : '';
    return (
      d
        .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
        .toUpperCase()
        .replace(',', ' ·') + rel
    );
  }, [selected, todayIso]);

  return (
    <View style={{ flex: 1, backgroundColor: ed.colors.bg }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: 24,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
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
          Calendar
        </Text>
        <EditorialHeadline size="title1">{`Every dose, *on the calendar*.`}</EditorialHeadline>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingTop: 24, paddingBottom: insets.bottom + 64 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Month nav */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 24,
            marginBottom: 18,
          }}
        >
          <Pressable
            onPress={() => goMonth(-1)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          >
            <IconChevronLeft size={18} color={ed.colors.ink2} />
          </Pressable>
          <Pressable onPress={goToday} accessibilityRole="button" accessibilityLabel="Jump to today">
            <Text
              style={{
                fontFamily: ed.typography.label.fontFamily,
                fontSize: ed.typography.label.fontSize,
                letterSpacing: ed.typography.label.letterSpacing,
                color: ed.colors.ink1,
                textTransform: 'uppercase',
              }}
            >
              {monthLabel}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => goMonth(1)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          >
            <IconChevronRight size={18} color={ed.colors.ink2} />
          </Pressable>
        </View>

        {/* Weekday header */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 18, marginBottom: 6 }}>
          {WEEKDAYS.map((w, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text
                style={{
                  fontFamily: ed.typography.labelSm.fontFamily,
                  fontSize: ed.typography.labelSm.fontSize,
                  letterSpacing: ed.typography.labelSm.letterSpacing,
                  color: ed.colors.ink3,
                  textTransform: 'uppercase',
                }}
              >
                {w}
              </Text>
            </View>
          ))}
        </View>

        {/* Month grid */}
        <View style={{ paddingHorizontal: 18 }}>
          {weeks.map((week, wi) => (
            <View key={wi} style={{ flexDirection: 'row' }}>
              {week.map((cell, ci) => {
                if (!cell) return <View key={ci} style={{ flex: 1, height: 54 }} />;
                const iso = isoLocal(cell);
                const isToday = iso === todayIso;
                const isSelected = iso === selected;
                const dots = dotsFor(iso);
                return (
                  <Pressable
                    key={ci}
                    onPress={() => setSelected(iso)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${cell.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}${
                      dots.length ? `, ${dots.length} marker${dots.length === 1 ? '' : 's'}` : ''
                    }`}
                    style={{ flex: 1, height: 54, alignItems: 'center', paddingTop: 6 }}
                  >
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSelected ? ed.colors.ink1 : 'transparent',
                        borderWidth: isToday && !isSelected ? 1 : 0,
                        borderColor: ed.colors.brand,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: ed.typography.dataMd.fontFamily,
                          fontSize: ed.typography.dataMd.fontSize,
                          color: isSelected ? ed.colors.bg : ed.colors.ink1,
                        }}
                      >
                        {cell.getDate()}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 3, marginTop: 4, height: 6 }}>
                      {dots.map((dot, di) => (
                        <View
                          key={di}
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 3,
                            backgroundColor: dot.filled ? dot.color : 'transparent',
                            borderWidth: dot.filled ? 0 : 1,
                            borderColor: dot.color,
                          }}
                        />
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {activeCount === 0 ? (
          <View style={{ paddingHorizontal: 24, marginTop: 18 }}>
            <Text
              style={{
                fontFamily: ed.typography.labelSm.fontFamily,
                fontSize: ed.typography.labelSm.fontSize,
                letterSpacing: ed.typography.labelSm.letterSpacing,
                color: ed.colors.ink3,
                textTransform: 'uppercase',
              }}
            >
              No active cycles — start one to project your schedule
            </Text>
          </View>
        ) : null}

        {/* Selected-day detail */}
        <View style={{ paddingHorizontal: 24, marginTop: 32 }}>
          <EyebrowLabel withRule>{selectedHeading}</EyebrowLabel>

          {selScheduled.length === 0 && selDoses.length === 0 ? (
            <Text
              style={{
                marginTop: 16,
                fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                fontSize: 18,
                color: ed.colors.ink3,
              }}
            >
              Nothing scheduled or logged.
            </Text>
          ) : null}

          {/* Scheduled (the plan + adherence status) */}
          {selScheduled.length > 0 ? (
            <View style={{ marginTop: 8 }}>
              <Text
                style={{
                  marginTop: 10,
                  marginBottom: 2,
                  fontFamily: ed.typography.labelSm.fontFamily,
                  fontSize: ed.typography.labelSm.fontSize,
                  letterSpacing: ed.typography.labelSm.letterSpacing,
                  color: ed.colors.ink3,
                  textTransform: 'uppercase',
                }}
              >
                Scheduled
              </Text>
              {selScheduled.map((item, idx) => {
                const p = findPeptide(item.peptide_id);
                const status = statusFor(item);
                const meta = statusMeta[status];
                const tappable = status === 'due';
                return (
                  <View key={`${item.cycle_id}-${item.peptide_id}-${idx}`}>
                    <Pressable
                      disabled={!tappable}
                      onPress={() =>
                        router.push({
                          pathname: '/log-dose',
                          params: {
                            peptideId: item.peptide_id,
                            prefillDoseMcg: item.dose_mcg,
                            cycleId: item.cycle_id,
                          },
                        } as never)
                      }
                      accessibilityRole={tappable ? 'button' : 'text'}
                      accessibilityLabel={`${p?.name ?? item.peptide_id}, ${meta.label}${
                        tappable ? ', tap to log' : ''
                      }`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        paddingVertical: 14,
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          marginTop: 7,
                          backgroundColor: p?.color ?? ed.colors.ink3,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                          <Text
                            style={{
                              fontFamily: ed.fraunces('Fraunces_400Regular'),
                              fontSize: 17,
                              letterSpacing: -0.2,
                              color: ed.colors.ink1,
                            }}
                          >
                            {p?.name ?? item.peptide_id}
                          </Text>
                          <Text
                            style={{
                              fontFamily: ed.typography.dataMd.fontFamily,
                              fontSize: ed.typography.dataMd.fontSize,
                              color: ed.colors.ink2,
                            }}
                          >
                            {formatDoseLabel(item.dose_mcg, doseUnitPref)}
                          </Text>
                        </View>
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
                          {item.freq} · {item.cycle_name}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontFamily: ed.typography.labelSm.fontFamily,
                          fontSize: ed.typography.labelSm.fontSize,
                          letterSpacing: ed.typography.labelSm.letterSpacing,
                          color: meta.color,
                          textTransform: 'uppercase',
                          marginTop: 2,
                        }}
                      >
                        {meta.label}
                      </Text>
                    </Pressable>
                    {idx < selScheduled.length - 1 ? <HairlineRow /> : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* Logged (the record) — tap for detail */}
          {selDoses.length > 0 ? (
            <View style={{ marginTop: 20 }}>
              <Text
                style={{
                  marginBottom: 2,
                  fontFamily: ed.typography.labelSm.fontFamily,
                  fontSize: ed.typography.labelSm.fontSize,
                  letterSpacing: ed.typography.labelSm.letterSpacing,
                  color: ed.colors.ink3,
                  textTransform: 'uppercase',
                }}
              >
                Logged
              </Text>
              {selDoses.map((d, idx) => {
                const p = findPeptide(d.peptide_id);
                const time = new Date(d.taken_at)
                  .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                  .replace(' ', '')
                  .toUpperCase();
                return (
                  <View key={d.id}>
                    <Pressable
                      onPress={() => setOpenDose(d)}
                      accessibilityRole="button"
                      accessibilityLabel={`Open logged dose: ${p?.name ?? d.peptide_id}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        paddingVertical: 14,
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          marginTop: 7,
                          backgroundColor: p?.color ?? ed.colors.ink3,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                          <Text
                            style={{
                              fontFamily: ed.fraunces('Fraunces_400Regular'),
                              fontSize: 17,
                              letterSpacing: -0.2,
                              color: ed.colors.ink1,
                            }}
                          >
                            {p?.name ?? d.peptide_id}
                          </Text>
                          <Text
                            style={{
                              fontFamily: ed.typography.dataMd.fontFamily,
                              fontSize: ed.typography.dataMd.fontSize,
                              color: ed.colors.ink2,
                            }}
                          >
                            {formatDoseLabel(d.amount_mcg, doseUnitPref)}
                          </Text>
                        </View>
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
                          {time}
                          {d.site ? ` · ${d.site}` : ''}
                          {d.route && d.route !== 'SubQ' ? ` · ${d.route}` : ''}
                        </Text>
                      </View>
                    </Pressable>
                    {idx < selDoses.length - 1 ? <HairlineRow /> : null}
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <DoseDetailSheet dose={openDose} onClose={() => setOpenDose(null)} onDeleted={() => refresh()} />
    </View>
  );
}
