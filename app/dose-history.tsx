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
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DoseDetailSheet } from '../components/DoseDetailSheet';
import { IconChevronLeft } from '../components/Icons';
import {
  listActiveCycles,
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

function startOfRange(range: DateRangeKey, activeCycles: Cycle[]): Date | null {
  const now = new Date();
  if (range === 'all') return null;
  if (range === 'cycle') {
    // Earliest start_on across all active cycles — covers concurrent
    // protocols that started on different days.
    const starts = activeCycles
      .filter((c) => c.status === 'active')
      .map((c) => new Date(c.starts_on).getTime());
    if (starts.length === 0) return null;
    return new Date(Math.min(...starts));
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
  // Multi-cycle: 'This cycle' filter covers ANY currently-active cycle.
  const [activeCycles, setActiveCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters — peptide / site / route / cycle are multi-select; range is
  // single-select. The cycle filter accepts a sentinel '__none__' string
  // for "doses without a cycle" so orphans don't silently disappear when
  // any other cycle is selected. Sites and routes are adaptive: chips
  // only render for values the user has actually logged.
  const [selectedPeptides, setSelectedPeptides] = useState<Set<string>>(new Set());
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
  const [selectedRoutes, setSelectedRoutes] = useState<Set<string>>(new Set());
  const [selectedCycles, setSelectedCycles] = useState<Set<string>>(new Set());
  const [range, setRange] = useState<DateRangeKey>('30d');
  const [exporting, setExporting] = useState(false);
  // Sheet for the dose tapped in the list.
  const [openDose, setOpenDose] = useState<Dose | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [d, c, acs] = await Promise.all([
      listDoses({ limit: 1000 }),
      listCycles(),
      listActiveCycles(),
    ]);
    setDoses(d);
    setCycles(c);
    setActiveCycles(acs);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Adaptive chips — peptides / sites / routes only render when the user
  // has actually logged data with those values. A SubQ-only user doesn't
  // need an "Oral" filter chip cluttering the row.
  const usedPeptideIds = useMemo(() => {
    const set = new Set<string>();
    for (const d of doses) set.add(d.peptide_id);
    return Array.from(set);
  }, [doses]);
  const usedSites = useMemo(() => {
    const set = new Set<string>();
    for (const d of doses) if (d.site) set.add(d.site);
    return Array.from(set).sort();
  }, [doses]);
  const usedRoutes = useMemo(() => {
    const set = new Set<string>();
    for (const d of doses) set.add(d.route);
    return Array.from(set).sort();
  }, [doses]);
  // Cycles the user could plausibly want to filter by — anything that has
  // at least one dose attached. Sorted with active cycles on top so they
  // bubble in the chip row.
  const usedCycles = useMemo(() => {
    const seen = new Set<string>();
    for (const d of doses) if (d.cycle_id) seen.add(d.cycle_id);
    const list = cycles.filter((c) => seen.has(c.id));
    return list.sort((a, b) => {
      const aActive = a.status === 'active' ? 0 : 1;
      const bActive = b.status === 'active' ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return b.starts_on.localeCompare(a.starts_on);
    });
  }, [doses, cycles]);
  // True when at least one orphan dose exists — controls whether the "No
  // cycle" chip appears at all. Don't show a filter for an empty bucket.
  const hasOrphans = useMemo(() => doses.some((d) => !d.cycle_id), [doses]);

  const filtered = useMemo(() => {
    const start = startOfRange(range, activeCycles);
    return doses.filter((d) => {
      if (selectedPeptides.size > 0 && !selectedPeptides.has(d.peptide_id)) return false;
      if (selectedSites.size > 0 && (!d.site || !selectedSites.has(d.site))) return false;
      if (selectedRoutes.size > 0 && !selectedRoutes.has(d.route)) return false;
      if (selectedCycles.size > 0) {
        const key = d.cycle_id ?? '__none__';
        if (!selectedCycles.has(key)) return false;
      }
      if (start && new Date(d.taken_at).getTime() < start.getTime()) return false;
      return true;
    });
  }, [doses, selectedPeptides, selectedSites, selectedRoutes, selectedCycles, range, activeCycles]);

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
    setSelectedPeptides((prev) => toggleInSet(prev, id));
  };
  const toggleSite = (s: string) => setSelectedSites((prev) => toggleInSet(prev, s));
  const toggleRoute = (r: string) => setSelectedRoutes((prev) => toggleInSet(prev, r));
  const toggleCycle = (id: string) => setSelectedCycles((prev) => toggleInSet(prev, id));

  const clearAllFilters = () => {
    setSelectedPeptides(new Set());
    setSelectedSites(new Set());
    setSelectedRoutes(new Set());
    setSelectedCycles(new Set());
    setRange('30d');
  };
  const hasAnyFilter =
    selectedPeptides.size > 0 ||
    selectedSites.size > 0 ||
    selectedRoutes.size > 0 ||
    selectedCycles.size > 0 ||
    range !== '30d';

  // Export the currently-filtered list as a CSV the user can hand off to
  // a clinician. Reuses the same csvCell escape logic that ships in the
  // global Settings → Export flow (leading =/+/-/@ get a leading apostrophe
  // so spreadsheets don't treat exported notes as formulas). The file
  // name encodes the active filters so multiple exports don't collide.
  const exportFilteredCsv = async () => {
    if (filtered.length === 0 || exporting) return;
    setExporting(true);
    try {
      const header = [
        'taken_at',
        'peptide',
        'amount_mcg',
        'volume_units',
        'route',
        'site',
        'cycle',
        'note',
      ];
      const rows = filtered.map((d) => {
        const p = findPeptide(d.peptide_id);
        const cycle = d.cycle_id ? cycleLookup[d.cycle_id]?.name : '';
        return [
          d.taken_at,
          p?.name ?? d.peptide_id,
          d.amount_mcg,
          d.volume_units ?? '',
          d.route,
          d.site ?? '',
          cycle ?? '',
          d.note ?? '',
        ];
      });
      const lines = [header.map(csvCell).join(',')];
      for (const r of rows) lines.push(r.map(csvCell).join(','));
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const tag = [
        range !== 'all' ? range : null,
        selectedPeptides.size === 1
          ? findPeptide(Array.from(selectedPeptides)[0])?.id
          : null,
      ]
        .filter(Boolean)
        .join('-');
      const filename = `helix-doses${tag ? '-' + tag : ''}-${ts}.csv`;
      const dir = FileSystem.documentDirectory ?? '';
      const path = `${dir}${filename}`;
      await FileSystem.writeAsStringAsync(path, lines.join('\n'));
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
      else Alert.alert('Saved', `Wrote ${filtered.length} doses to ${filename}`);
    } catch (err) {
      Alert.alert('Export failed', err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
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
            const disabled =
              r.key === 'cycle' && !activeCycles.some((c) => c.status === 'active');
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

        {/* Adaptive site filter — only the sites the user has actually
            injected. Collapses to nothing for users who only ever pick
            the default site. */}
        {usedSites.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: space.xl, gap: 6 }}
            style={{ flexGrow: 0, marginBottom: space.sm }}
          >
            <FilterLabel>Site</FilterLabel>
            {usedSites.map((s) => {
              const active = selectedSites.has(s);
              return (
                <Pressable
                  key={s}
                  onPress={() => toggleSite(s)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`Filter by site ${s}`}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: radius.pill,
                    backgroundColor: active ? t.accentSoft : 'transparent',
                    borderWidth: 1,
                    borderColor: active ? t.accent : t.line,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: active ? t.accentInk : t.ink2,
                      fontFamily: font.sansMed,
                    }}
                  >
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Adaptive route filter — only renders for users with mixed
            routes. SubQ-only users never see it. */}
        {usedRoutes.length > 1 ? (
          <View
            style={{
              paddingHorizontal: space.xl,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
              alignItems: 'center',
              marginBottom: space.sm,
            }}
          >
            <FilterLabel>Route</FilterLabel>
            {usedRoutes.map((r) => {
              const active = selectedRoutes.has(r);
              return (
                <Pressable
                  key={r}
                  onPress={() => toggleRoute(r)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`Filter by route ${r}`}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: radius.pill,
                    backgroundColor: active ? t.accentSoft : 'transparent',
                    borderWidth: 1,
                    borderColor: active ? t.accent : t.line,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: active ? t.accentInk : t.ink2,
                      fontFamily: font.sansMed,
                    }}
                  >
                    {r}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Cycle filter with explicit 'No cycle' option for orphan doses.
            Without this chip a user filtering by any cycle would silently
            hide their pre-cycle / ad-hoc logs. */}
        {usedCycles.length > 0 || hasOrphans ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: space.xl, gap: 6 }}
            style={{ flexGrow: 0, marginBottom: space.md }}
          >
            <FilterLabel>Cycle</FilterLabel>
            {usedCycles.map((c) => {
              const active = selectedCycles.has(c.id);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => toggleCycle(c.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`Filter by cycle ${c.name}`}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: radius.pill,
                    backgroundColor: active ? t.accentSoft : 'transparent',
                    borderWidth: 1,
                    borderColor: active ? t.accent : t.line,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: active ? t.accentInk : t.ink2,
                      fontFamily: font.sansMed,
                    }}
                  >
                    {c.name}
                    {c.status !== 'active' ? ` · ${c.status}` : ''}
                  </Text>
                </Pressable>
              );
            })}
            {hasOrphans ? (
              <Pressable
                onPress={() => toggleCycle('__none__')}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selectedCycles.has('__none__') }}
                accessibilityLabel="Filter by doses with no cycle"
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: radius.pill,
                  backgroundColor: selectedCycles.has('__none__') ? t.warnSoft : 'transparent',
                  borderWidth: 1,
                  borderColor: selectedCycles.has('__none__') ? t.warn : t.line,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: selectedCycles.has('__none__') ? t.warn : t.ink2,
                    fontFamily: font.sansMed,
                  }}
                >
                  No cycle
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        ) : null}

        {/* Export filtered view → CSV. Hidden until there's something to
            export. Filename encodes the active filter so multiple exports
            don't collide. */}
        {filtered.length > 0 ? (
          <View
            style={{
              paddingHorizontal: space.xl,
              flexDirection: 'row',
              gap: 8,
              marginBottom: space.md,
            }}
          >
            <Pressable
              onPress={exportFilteredCsv}
              disabled={exporting}
              accessibilityRole="button"
              accessibilityLabel="Export filtered list as CSV"
              style={{
                flex: 1,
                paddingVertical: 9,
                paddingHorizontal: 12,
                borderRadius: radius.md,
                backgroundColor: exporting ? t.surfaceAlt : t.surface,
                borderWidth: 1,
                borderColor: t.line,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 12, fontFamily: font.sansSemi, color: t.ink }}>
                {exporting ? 'Preparing CSV…' : `Export ${filtered.length} doses → CSV`}
              </Text>
            </Pressable>
            {hasAnyFilter ? (
              <Pressable
                onPress={clearAllFilters}
                accessibilityRole="button"
                accessibilityLabel="Clear all filters"
                style={{
                  paddingVertical: 9,
                  paddingHorizontal: 12,
                  borderRadius: radius.md,
                  backgroundColor: t.surface,
                  borderWidth: 1,
                  borderColor: t.line,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 12, fontFamily: font.sansMed, color: t.ink3 }}>
                  Clear filters
                </Text>
              </Pressable>
            ) : null}
          </View>
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

// Set toggle helper extracted because all four multi-select filters need
// the same flip-on/flip-off behavior. Returns a NEW Set so React picks
// up the change.
function toggleInSet<T>(prev: Set<T>, value: T): Set<T> {
  const next = new Set(prev);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

// Mirror of the csvCell helper in app/settings/export.tsx — neutralizes
// formula injection by prefixing any cell starting with =/+/-/@ with a
// single quote, then double-quoting and escaping internal quotes. Kept
// inline rather than re-exported to avoid a cross-route module import.
// Tiny inline label for each filter row's leading chip — keeps the
// horizontal scrollers self-explanatory at a glance ("Site · …" etc.)
// without taking up a separate row.
function FilterLabel({ children }: { children: string }) {
  // Local theme hook avoids drilling tokens through props.
  const { t } = useTheme();
  return (
    <View
      style={{
        paddingVertical: 6,
        paddingRight: 4,
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: 10,
          letterSpacing: 0.8,
          color: t.ink3,
          fontFamily: font.sansSemi,
          textTransform: 'uppercase',
        }}
      >
        {children}
      </Text>
    </View>
  );
}

function csvCell(v: unknown): string {
  const raw = v == null ? '' : typeof v === 'string' ? v : String(v);
  const s = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return '"' + s.replace(/"/g, '""') + '"';
}
