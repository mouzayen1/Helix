// Dose history — reverse-chronological list of every logged dose with
// adaptive peptide / site / route / cycle filters, smart stats header,
// and CSV export. Editorial restyle of the v1.2 screen — same data
// flow, sharp-corner chips, hairline-divided list, serif numerals.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DoseDetailSheet } from '../components/DoseDetailSheet';
import { EditorialButton } from '../components/editorial/EditorialButton';
import { EditorialHeadline } from '../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../components/editorial/EyebrowLabel';
import { HairlineRow } from '../components/editorial/HairlineRow';
import { useEditorialTheme } from '../lib/design/theme';
import { DoseValue } from '../components/editorial/DoseUnitChip';
import { useDoseUnitPref } from '../lib/profile-context';
import { formatDoseLabel, resolveDoseUnit } from '../lib/dose-format';
// Platform-split file export (native share sheet / web download).
import { saveExport } from '../lib/export-file';
import {
  listActiveCycles,
  listCycles,
  listDoses,
  type Cycle,
  type Dose,
} from '../lib/db';
import { findPeptide } from '../lib/peptides';

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
  const ed = useEditorialTheme();
  const { pref: doseUnitPref } = useDoseUnitPref();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [doses, setDoses] = useState<Dose[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [activeCycles, setActiveCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPeptides, setSelectedPeptides] = useState<Set<string>>(new Set());
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
  const [selectedRoutes, setSelectedRoutes] = useState<Set<string>>(new Set());
  const [selectedCycles, setSelectedCycles] = useState<Set<string>>(new Set());
  const [range, setRange] = useState<DateRangeKey>('30d');
  const [exporting, setExporting] = useState(false);
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

  const stats = useMemo(() => {
    const count = filtered.length;
    const totalMcg = filtered.reduce((s, d) => s + d.amount_mcg, 0);
    const totalMg = totalMcg / 1000;
    const cycleIds = new Set(filtered.map((d) => d.cycle_id).filter(Boolean));
    const peptideIds = new Set(filtered.map((d) => d.peptide_id));
    const orphanCount = filtered.filter((d) => !d.cycle_id).length;
    return {
      count,
      totalMcg,
      totalMg,
      cycleCount: cycleIds.size,
      peptideCount: peptideIds.size,
      orphanCount,
    };
  }, [filtered]);

  const statsLine = useMemo(() => {
    if (stats.count === 0) return 'No doses match this filter';
    const parts: string[] = [];
    parts.push(`${stats.count} dose${stats.count === 1 ? '' : 's'}`);
    // Aggregations always benefit from mg display once they cross 1 mg,
    // even if user prefers mcg per-dose. Force mg here; per-row chips
    // still respect the global pref.
    const totalUnit = resolveDoseUnit(stats.totalMcg, doseUnitPref);
    const totalLabel =
      totalUnit === 'mg'
        ? `${stats.totalMg.toFixed(stats.totalMg < 1 ? 3 : 2)} mg`
        : `${Math.round(stats.totalMcg)} mcg`;
    parts.push(totalLabel);
    if (selectedPeptides.size === 1) {
      const id = Array.from(selectedPeptides)[0];
      const p = findPeptide(id);
      if (p) parts[parts.length - 1] = `${totalLabel} of ${p.name}`;
    } else if (stats.peptideCount > 1) {
      parts.push(`${stats.peptideCount} peptides`);
    }
    if (stats.cycleCount > 0) {
      parts.push(`${stats.cycleCount} cycle${stats.cycleCount === 1 ? '' : 's'}`);
    }
    return parts.join(' · ');
  }, [stats, selectedPeptides]);

  const togglePeptide = (id: string) =>
    setSelectedPeptides((prev) => toggleInSet(prev, id));
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

  const cycleLookup = useMemo(() => {
    const map: Record<string, Cycle> = {};
    for (const c of cycles) map[c.id] = c;
    return map;
  }, [cycles]);

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
      await saveExport(filename, lines.join('\n'), 'text/csv');
    } catch (err) {
      Alert.alert('Export failed', err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  };

  const Chip = ({
    active,
    label,
    onPress,
    tone = 'ink',
    disabled,
  }: {
    active: boolean;
    label: string;
    onPress: () => void;
    tone?: 'ink' | 'brand' | 'warn';
    disabled?: boolean;
  }) => {
    const fill =
      tone === 'brand' ? ed.colors.brand : tone === 'warn' ? ed.colors.stateWarn : ed.colors.ink1;
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={{
          paddingVertical: 6,
          paddingHorizontal: 10,
          backgroundColor: active ? fill : 'transparent',
          borderWidth: 1,
          borderColor: active ? fill : ed.colors.lineStrong,
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <Text
          style={{
            fontFamily: ed.typography.labelSm.fontFamily,
            fontSize: ed.typography.labelSm.fontSize,
            letterSpacing: ed.typography.labelSm.letterSpacing,
            color: active ? ed.colors.bg : ed.colors.ink2,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const FilterRow = ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          fontFamily: ed.typography.labelSm.fontFamily,
          fontSize: ed.typography.labelSm.fontSize,
          letterSpacing: ed.typography.labelSm.letterSpacing,
          color: ed.colors.ink3,
          textTransform: 'uppercase',
          marginBottom: 8,
          paddingHorizontal: 24,
        }}
      >
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, gap: 6 }}
        style={{ flexGrow: 0 }}
      >
        {children}
      </ScrollView>
    </View>
  );

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
          Dose history
        </Text>
        <EditorialHeadline size="title1">{`Every *dose*, on the record.`}</EditorialHeadline>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingTop: 24, paddingBottom: insets.bottom + 64 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats line */}
        <View style={{ paddingHorizontal: 24, marginBottom: 18 }}>
          <Text
            style={{
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 19,
              lineHeight: 26,
              letterSpacing: -0.3,
              color: ed.colors.ink1,
            }}
          >
            {statsLine}
          </Text>
          {stats.orphanCount > 0 ? (
            <Text
              style={{
                marginTop: 6,
                fontFamily: ed.typography.labelSm.fontFamily,
                fontSize: ed.typography.labelSm.fontSize,
                letterSpacing: ed.typography.labelSm.letterSpacing,
                color: ed.colors.stateWarn,
                textTransform: 'uppercase',
              }}
            >
              {stats.orphanCount} dose{stats.orphanCount === 1 ? '' : 's'} not tied to a cycle
            </Text>
          ) : null}
        </View>

        {/* Date range */}
        <FilterRow label="Range">
          {RANGES.map((r) => {
            const active = range === r.key;
            const disabled =
              r.key === 'cycle' && !activeCycles.some((c) => c.status === 'active');
            return (
              <Chip
                key={r.key}
                active={active}
                label={r.label}
                disabled={disabled}
                onPress={() => !disabled && setRange(r.key)}
              />
            );
          })}
        </FilterRow>

        {/* Adaptive peptide filter */}
        {usedPeptideIds.length > 0 ? (
          <FilterRow label="Peptide">
            {usedPeptideIds.map((id) => {
              const p = findPeptide(id);
              const active = selectedPeptides.has(id);
              return (
                <Pressable
                  key={id}
                  onPress={() => togglePeptide(id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    backgroundColor: active ? ed.colors.brand : 'transparent',
                    borderWidth: 1,
                    borderColor: active ? ed.colors.brand : ed.colors.lineStrong,
                  }}
                >
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: p?.color ?? ed.colors.ink3,
                    }}
                  />
                  <Text
                    style={{
                      fontFamily: ed.typography.labelSm.fontFamily,
                      fontSize: ed.typography.labelSm.fontSize,
                      letterSpacing: ed.typography.labelSm.letterSpacing,
                      color: active ? ed.colors.bg : ed.colors.ink2,
                      textTransform: 'uppercase',
                    }}
                  >
                    {p?.name ?? id}
                  </Text>
                </Pressable>
              );
            })}
          </FilterRow>
        ) : null}

        {usedSites.length > 1 ? (
          <FilterRow label="Site">
            {usedSites.map((s) => (
              <Chip
                key={s}
                active={selectedSites.has(s)}
                label={s}
                tone="brand"
                onPress={() => toggleSite(s)}
              />
            ))}
          </FilterRow>
        ) : null}

        {usedRoutes.length > 1 ? (
          <FilterRow label="Route">
            {usedRoutes.map((r) => (
              <Chip
                key={r}
                active={selectedRoutes.has(r)}
                label={r}
                onPress={() => toggleRoute(r)}
              />
            ))}
          </FilterRow>
        ) : null}

        {usedCycles.length > 0 || hasOrphans ? (
          <FilterRow label="Cycle">
            {usedCycles.map((c) => (
              <Chip
                key={c.id}
                active={selectedCycles.has(c.id)}
                label={`${c.name}${c.status !== 'active' ? ` · ${c.status}` : ''}`}
                tone="brand"
                onPress={() => toggleCycle(c.id)}
              />
            ))}
            {hasOrphans ? (
              <Chip
                active={selectedCycles.has('__none__')}
                label="No cycle"
                tone="warn"
                onPress={() => toggleCycle('__none__')}
              />
            ) : null}
          </FilterRow>
        ) : null}

        {/* Export + clear */}
        {filtered.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              paddingHorizontal: 24,
              marginBottom: 18,
            }}
          >
            <View style={{ flex: 1 }}>
              <EditorialButton
                variant="secondary"
                fullWidth
                disabled={exporting}
                onPress={exportFilteredCsv}
              >
                {exporting ? 'Preparing CSV…' : `Export ${filtered.length} → CSV`}
              </EditorialButton>
            </View>
            {hasAnyFilter ? (
              <EditorialButton variant="secondary" onPress={clearAllFilters}>
                Clear
              </EditorialButton>
            ) : null}
          </View>
        ) : null}

        {/* List */}
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
        ) : filtered.length === 0 ? (
          <View style={{ paddingHorizontal: 24, paddingVertical: 28, alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                fontSize: 19,
                color: ed.colors.ink2,
                textAlign: 'center',
              }}
            >
              No doses in this view.
            </Text>
            <Text
              style={{
                marginTop: 6,
                fontFamily: ed.typography.bodySm.fontFamily,
                fontSize: ed.typography.bodySm.fontSize,
                lineHeight: ed.typography.bodySm.lineHeight,
                color: ed.colors.ink3,
                textAlign: 'center',
                maxWidth: 320,
              }}
            >
              {doses.length === 0
                ? "You haven't logged a dose yet. Start from Today or a peptide page."
                : 'Try widening the date range or clearing the peptide filter.'}
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 24 }}>
            <EyebrowLabel withRule>{`${filtered.length} doses`}</EyebrowLabel>
            <View style={{ marginTop: 4 }}>
              {filtered.map((d, idx) => {
                const p = findPeptide(d.peptide_id);
                const cycle = d.cycle_id ? cycleLookup[d.cycle_id] : null;
                const when = new Date(d.taken_at);
                const timePart = when.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                });
                const datePart = when.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year:
                    when.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
                });
                return (
                  <View key={d.id}>
                    <Pressable
                      onPress={() => setOpenDose(d)}
                      accessibilityRole="button"
                      accessibilityLabel={`Open dose: ${p?.name ?? d.peptide_id}, ${formatDoseLabel(d.amount_mcg, doseUnitPref)}, ${when.toLocaleString()}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        paddingVertical: 16,
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          marginTop: 8,
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
                          <DoseValue
                            mcg={d.amount_mcg}
                            valueStyle={{
                              fontFamily: ed.typography.dataMd.fontFamily,
                              fontSize: ed.typography.dataMd.fontSize,
                              color: ed.colors.ink2,
                            }}
                          />
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
                          {datePart} · {timePart}
                          {d.site ? ` · ${d.site}` : ''}
                          {d.route && d.route !== 'SubQ' ? ` · ${d.route}` : ''}
                          {cycle ? ` · ${cycle.name}` : ''}
                        </Text>
                        {d.note ? (
                          <Text
                            numberOfLines={1}
                            style={{
                              marginTop: 4,
                              fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                              fontSize: 13,
                              color: ed.colors.ink3,
                            }}
                          >
                            {d.note}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                    {idx < filtered.length - 1 ? <HairlineRow /> : null}
                  </View>
                );
              })}
            </View>
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

function toggleInSet<T>(prev: Set<T>, value: T): Set<T> {
  const next = new Set(prev);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function csvCell(v: unknown): string {
  const raw = v == null ? '' : typeof v === 'string' ? v : String(v);
  const s = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return '"' + s.replace(/"/g, '""') + '"';
}
