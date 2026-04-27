// Dose history — reverse-chronological list of every logged dose with
// adaptive peptide / date-range filters and a smart stats header.
//
// Two entry points: a card on Progress, a chip in the Stacks tab header.
// Same screen, two discovery surfaces — keeps "what did I take over time"
// (Progress framing) and "what's running through this protocol" (Stacks
// framing) on one canonical view instead of forking.
//
// Filter design choices:
//   - Peptide chips are ADAPTIVE: only peptides the user has actually
//     dosed appear. A user who has never taken Sema doesn't need a Sema
//     chip cluttering the row.
//   - Date range chips: 7d / 30d / 90d / This cycle / All. "This cycle"
//     is only enabled when there's an active cycle.
//   - Stats header rewrites itself based on the current filter so it
//     reads naturally — "47 doses · 11.75 mg of BPC-157 · across 3
//     cycles" rather than a static count line.
//
// v2 follow-ups (deferred): site / route / cycle-id filters, free-text
// note search, group-by-week toggle, export filtered CSV.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DoseDetailSheet } from '../components/DoseDetailSheet';
import { IconChevronLeft } from '../components/Icons';
import {
  getActiveCycle,
  listCycles,
  listDoses,
  type Cycle,
  type Dose,
} from '../lib/db';
import { findPeptide } from '../lib/peptides';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, space } from '../theme/tokens';

type DateRangeKey = '7d' | '30d' | '90d' | 'cycle' | 'all';

const RANGES: { key: DateRangeKey; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'cycle', label: 'This cycle' },
  { key: 'all', label: 'All' },
];

function startOfRange(range: DateRangeKey, activeCycle: Cycle | null): Date | null {
  const now = new Date();
  if (range === 'all') return null;
  if (range === 'cycle') {
    return activeCycle ? new Date(activeCycle.starts_on) : null;
  }
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d;
}

export default function DoseHistoryScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [doses, setDoses] = useState<Dose[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters — peptide is multi-select, range is single-select.
  const [selectedPeptides, setSelectedPeptides] = useState<Set<string>>(new Set());
  const [range, setRange] = useState<DateRangeKey>('30d');
  // Sheet for the dose tapped in the list.
  const [openDose, setOpenDose] = useState<Dose | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [d, c, active] = await Promise.all([
      listDoses({ limit: 1000 }),
      listCycles(),
      getActiveCycle(),
    ]);
    setDoses(d);
    setCycles(c);
    setActiveCycle(active);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Adaptive peptide chips — only the peptides the user has actually
  // dosed. Cuts down the chip row from 42 to 1-5 in practice.
  const usedPeptideIds = useMemo(() => {
    const set = new Set<string>();
    for (const d of doses) set.add(d.peptide_id);
    return Array.from(set);
  }, [doses]);

  const filtered = useMemo(() => {
    const start = startOfRange(range, activeCycle);
    return doses.filter((d) => {
      if (selectedPeptides.size > 0 && !selectedPeptides.has(d.peptide_id)) return false;
      if (start && new Date(d.taken_at).getTime() < start.getTime()) return false;
      return true;
    });
  }, [doses, selectedPeptides, range, activeCycle]);

  // Stats header — adapts to the active filter so it always reads
  // naturally. Half the perceived intelligence of this screen lives here.
  const stats = useMemo(() => {
    const count = filtered.length;
    const totalMg = filtered.reduce((s, d) => s + d.amount_mcg / 1000, 0);
    const cycleIds = new Set(filtered.map((d) => d.cycle_id).filter(Boolean));
    const peptideIds = new Set(filtered.map((d) => d.peptide_id));
    const orphanCount = filtered.filter((d) => !d.cycle_id).length;
    return { count, totalMg, cycleCount: cycleIds.size, peptideCount: peptideIds.size, orphanCount };
  }, [filtered]);

  const statsLine = useMemo(() => {
    if (stats.count === 0) return 'No doses match this filter';
    const parts: string[] = [];
    parts.push(`${stats.count} dose${stats.count === 1 ? '' : 's'}`);
    parts.push(`${stats.totalMg.toFixed(stats.totalMg < 1 ? 3 : 2)} mg`);
    // When a single peptide is selected, name it explicitly — "11.75 mg
    // of BPC-157" reads better than "11.75 mg · 1 peptide".
    if (selectedPeptides.size === 1) {
      const id = Array.from(selectedPeptides)[0];
      const p = findPeptide(id);
      if (p) parts[parts.length - 1] = `${stats.totalMg.toFixed(stats.totalMg < 1 ? 3 : 2)} mg of ${p.name}`;
    } else if (stats.peptideCount > 1) {
      parts.push(`${stats.peptideCount} peptides`);
    }
    if (stats.cycleCount > 0) {
      parts.push(`${stats.cycleCount} cycle${stats.cycleCount === 1 ? '' : 's'}`);
    }
    return parts.join(' · ');
  }, [stats, selectedPeptides]);

  const togglePeptide = (id: string) => {
    setSelectedPeptides((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cycleLookup = useMemo(() => {
    const map: Record<string, Cycle> = {};
    for (const c of cycles) map[c.id] = c;
    return map;
  }, [cycles]);

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
        <Text style={{ fontSize: 20, fontFamily: font.sansBold, color: t.ink }}>
          Dose history
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space['2xl'] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats header */}
        <View style={{ paddingHorizontal: space.xl, marginBottom: space.md }}>
          <Text
            style={{
              fontSize: 14,
              color: t.ink,
              fontFamily: font.sansSemi,
              lineHeight: 20,
            }}
          >
            {statsLine}
          </Text>
          {stats.orphanCount > 0 ? (
            <Text
              style={{
                fontSize: 11,
                color: t.warn,
                fontFamily: font.sansMed,
                marginTop: 4,
                letterSpacing: 0.4,
              }}
            >
              {stats.orphanCount} dose{stats.orphanCount === 1 ? '' : 's'} not tied to a cycle
            </Text>
          ) : null}
        </View>

        {/* Date-range chips */}
        <View
          style={{
            paddingHorizontal: space.xl,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: space.sm,
          }}
        >
          {RANGES.map((r) => {
            const active = range === r.key;
            const disabled = r.key === 'cycle' && !activeCycle;
            return (
              <Pressable
                key={r.key}
                onPress={() => !disabled && setRange(r.key)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled }}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: radius.pill,
                  backgroundColor: active ? t.ink : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? t.ink : t.line,
                  opacity: disabled ? 0.4 : 1,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: active ? t.bg : t.ink2,
                    fontFamily: font.sansMed,
                  }}
                >
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Adaptive peptide chips — only peptides the user has actually dosed */}
        {usedPeptideIds.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: space.xl, gap: 6 }}
            style={{ flexGrow: 0, marginBottom: space.md }}
          >
            {usedPeptideIds.map((id) => {
              const p = findPeptide(id);
              const active = selectedPeptides.has(id);
              return (
                <Pressable
                  key={id}
                  onPress={() => togglePeptide(id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`Filter by ${p?.name ?? id}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: radius.pill,
                    backgroundColor: active ? t.accentSoft : 'transparent',
                    borderWidth: 1,
                    borderColor: active ? t.accent : t.line,
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
                  <Text
                    style={{
                      fontSize: 12,
                      color: active ? t.accentInk : t.ink2,
                      fontFamily: font.sansMed,
                    }}
                  >
                    {p?.name ?? id}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* List */}
        {loading ? (
          <Text style={{ paddingHorizontal: space.xl, color: t.ink3, fontSize: 13 }}>
            Loading…
          </Text>
        ) : filtered.length === 0 ? (
          <View style={{ paddingHorizontal: space.xl, paddingVertical: space.xl }}>
            <Text style={{ color: t.ink, fontSize: 14, fontFamily: font.sansSemi }}>
              No doses in this view
            </Text>
            <Text style={{ color: t.ink3, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
              {doses.length === 0
                ? "You haven't logged a dose yet. Start from Today or a peptide page."
                : 'Try widening the date range or clearing the peptide filter.'}
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: space.xl, gap: 6 }}>
            {filtered.map((d) => {
              const p = findPeptide(d.peptide_id);
              const cycle = d.cycle_id ? cycleLookup[d.cycle_id] : null;
              const when = new Date(d.taken_at);
              return (
                <Pressable
                  key={d.id}
                  onPress={() => setOpenDose(d)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open dose: ${p?.name ?? d.peptide_id}, ${d.amount_mcg} mcg, ${when.toLocaleString()}`}
                  style={{
                    backgroundColor: t.surface,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: t.line,
                    padding: space.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
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
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                      <Text
                        style={{ fontSize: 14, fontFamily: font.sansSemi, color: t.ink }}
                      >
                        {p?.name ?? d.peptide_id}
                      </Text>
                      <Text
                        style={{ fontSize: 12, color: t.ink, fontFamily: font.monoSemi }}
                      >
                        {d.amount_mcg} mcg
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 11,
                        color: t.ink3,
                        fontFamily: font.mono,
                        marginTop: 2,
                      }}
                    >
                      {when.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year:
                          when.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
                      })}
                      {' · '}
                      {when.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {d.site ? ` · ${d.site}` : ''}
                      {d.route && d.route !== 'SubQ' ? ` · ${d.route}` : ''}
                      {cycle ? ` · ${cycle.name}` : ''}
                    </Text>
                    {d.note ? (
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 11, color: t.ink3, marginTop: 3, fontStyle: 'italic' }}
                      >
                        {d.note}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <DoseDetailSheet
        dose={openDose}
        onClose={() => setOpenDose(null)}
        onDeleted={() => refresh()}
      />
    </View>
  );
}
