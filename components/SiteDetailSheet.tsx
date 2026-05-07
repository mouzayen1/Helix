// Bottom sheet that surfaces the dose history for one injection site.
//
// Opened from the chevron on each row of the Injection Sites screen.
// The row's primary tap target is unchanged (it still routes to Log
// Dose pre-filled with the site) — this sheet is the secondary
// "what's been logged here?" affordance, surfaced via an explicit
// chevron rather than a long-press so it stays discoverable.
//
// Threshold chips at the top let the user scope the view (≤7 / ≤14 /
// ≤28 / all). Default is ≤14 days — covers a typical injection cycle
// without overwhelming. Empty state pivots the user toward action:
// either widen the window or log a fresh dose at this site.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { EditorialButton } from './editorial/EditorialButton';
import { EditorialSheet } from './editorial/EditorialSheet';
import { useEditorialTheme } from '../lib/design/theme';
import { listDosesAtSite, type Dose } from '../lib/db';
import { findPeptide } from '../lib/peptides';
import { useDoseUnitPref } from '../lib/profile-context';
import { formatDoseLabel } from '../lib/dose-format';
import { formatRelativeAge } from '../lib/relative-time';

type Threshold = 7 | 14 | 28 | 'all';

const THRESHOLDS: Threshold[] = [7, 14, 28, 'all'];

export function SiteDetailSheet({
  site,
  onClose,
  onLogDose,
}: {
  /** When non-null, the sheet is visible and scoped to this site. */
  site: string | null;
  onClose: () => void;
  /** Fired when the in-sheet "Log dose here" CTA is pressed. */
  onLogDose: (site: string) => void;
}) {
  const ed = useEditorialTheme();
  const { pref: doseUnitPref } = useDoseUnitPref();
  const [doses, setDoses] = useState<Dose[]>([]);
  const [threshold, setThreshold] = useState<Threshold>(14);

  // Pull a generous window once when the sheet opens; the threshold
  // filter then trims that locally without re-querying.
  useEffect(() => {
    if (!site) return;
    setThreshold(14);
    let cancelled = false;
    listDosesAtSite(site, 100).then((d) => {
      if (!cancelled) setDoses(d);
    });
    return () => {
      cancelled = true;
    };
  }, [site]);

  const filtered = useMemo(() => {
    if (threshold === 'all') return doses;
    const cutoff = Date.now() - threshold * 86_400_000;
    return doses.filter((d) => new Date(d.taken_at).getTime() >= cutoff);
  }, [doses, threshold]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <EditorialSheet visible={!!site} onClose={onClose}>
      {site ? (
        <View>
          {/* Title + count line — count reflects the active threshold,
              not the total cached dose set, so it matches the list. */}
          <Text
            style={{
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 22,
              lineHeight: 28,
              letterSpacing: -0.4,
              color: ed.colors.ink1,
            }}
          >
            {site}
          </Text>
          <Text
            style={{
              marginTop: 4,
              fontFamily: ed.typography.dataMd.fontFamily,
              fontSize: ed.typography.dataMd.fontSize,
              color: ed.colors.ink3,
            }}
          >
            {filtered.length} {filtered.length === 1 ? 'dose' : 'doses'}
            {threshold === 'all' ? ' logged' : ` in last ${threshold} days`}
          </Text>

          {/* Threshold chip row. */}
          <View
            style={{
              flexDirection: 'row',
              gap: 6,
              marginTop: 16,
              flexWrap: 'wrap',
            }}
          >
            {THRESHOLDS.map((t) => {
              const active = t === threshold;
              const label = t === 'all' ? 'All' : `≤${t}d`;
              return (
                <Pressable
                  key={String(t)}
                  onPress={() => setThreshold(t)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    backgroundColor: active ? ed.colors.ink1 : 'transparent',
                    borderWidth: 1,
                    borderColor: active ? ed.colors.ink1 : ed.colors.lineStrong,
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
            })}
          </View>

          {/* Body: day-grouped dose list, or empty state. */}
          <View style={{ marginTop: 22 }}>
            {grouped.length === 0 ? (
              <EmptyState site={site} threshold={threshold} />
            ) : (
              grouped.map((g) => (
                <View key={g.dayKey} style={{ marginBottom: 18 }}>
                  <Text
                    style={{
                      fontFamily: ed.typography.labelSm.fontFamily,
                      fontSize: ed.typography.labelSm.fontSize,
                      letterSpacing: ed.typography.labelSm.letterSpacing,
                      color: ed.colors.ink3,
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    {g.label}
                  </Text>
                  <View
                    style={{
                      borderTopWidth: 1,
                      borderBottomWidth: 1,
                      borderColor: ed.colors.line,
                    }}
                  >
                    {g.doses.map((d, i) => {
                      const peptide = findPeptide(d.peptide_id);
                      return (
                        <View
                          key={d.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'baseline',
                            paddingVertical: 12,
                            gap: 12,
                            borderTopWidth: i === 0 ? 0 : 1,
                            borderTopColor: ed.colors.line,
                          }}
                        >
                          <Text
                            style={{
                              flex: 1,
                              fontFamily: ed.fraunces('Fraunces_400Regular'),
                              fontSize: 16,
                              letterSpacing: -0.2,
                              color: ed.colors.ink1,
                            }}
                            numberOfLines={1}
                          >
                            {peptide?.name ?? d.peptide_id}
                          </Text>
                          {/* Right-side data cluster — dose · age tightly
                              grouped so the eye reads them as one unit
                              and the flex space sits between the name
                              and the cluster, not between the two
                              mono values. */}
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'baseline',
                              gap: 6,
                            }}
                          >
                            <Text
                              style={{
                                fontFamily: ed.typography.dataMd.fontFamily,
                                fontSize: ed.typography.dataMd.fontSize,
                                color: ed.colors.ink2,
                              }}
                            >
                              {formatDoseLabel(d.amount_mcg, doseUnitPref)}
                            </Text>
                            <Text
                              style={{
                                fontFamily: ed.typography.dataMd.fontFamily,
                                fontSize: ed.typography.dataMd.fontSize,
                                color: ed.colors.ink4,
                              }}
                            >
                              ·
                            </Text>
                            <Text
                              style={{
                                fontFamily: ed.typography.dataMd.fontFamily,
                                fontSize: ed.typography.dataMd.fontSize,
                                color: ed.colors.ink3,
                              }}
                            >
                              {formatRelativeAge(d.taken_at)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))
            )}
          </View>

          {/* CTA — closes loop for users who came in to check, decided to log. */}
          <View style={{ marginTop: 8 }}>
            <EditorialButton
              fullWidth
              onPress={() => {
                onLogDose(site);
              }}
            >
              Log dose at this site →
            </EditorialButton>
          </View>
        </View>
      ) : null}
    </EditorialSheet>
  );
}

function EmptyState({ site, threshold }: { site: string; threshold: Threshold }) {
  const ed = useEditorialTheme();
  return (
    <View>
      <Text
        style={{
          fontFamily: ed.typography.labelSm.fontFamily,
          fontSize: ed.typography.labelSm.fontSize,
          letterSpacing: ed.typography.labelSm.letterSpacing,
          color: ed.colors.ink3,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        No doses in this window
      </Text>
      <Text
        style={{
          fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
          fontSize: 15,
          lineHeight: 23,
          color: ed.colors.ink2,
        }}
      >
        {threshold === 'all'
          ? `${site} has no logged doses yet.`
          : `${site} has had no logged doses in the last ${threshold} days. Tap "All" above to see your full history at this site.`}
      </Text>
    </View>
  );
}

// ---- helpers ---------------------------------------------------------------

type DayGroup = { dayKey: string; label: string; doses: Dose[] };

function groupByDay(doses: Dose[]): DayGroup[] {
  const groups = new Map<string, Dose[]>();
  for (const d of doses) {
    const key = dayKey(d.taken_at);
    const arr = groups.get(key);
    if (arr) arr.push(d);
    else groups.set(key, [d]);
  }
  // Map preserves insertion order; doses came in DESC so day groups
  // are already most-recent-first. Within each group, doses are also
  // already DESC because we pushed in iteration order.
  return Array.from(groups.entries()).map(([key, doses]) => ({
    dayKey: key,
    label: dayLabel(doses[0].taken_at),
    doses,
  }));
}

function dayKey(taken_at: string): string {
  const d = new Date(taken_at);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(taken_at: string): string {
  const d = new Date(taken_at);
  const today = new Date();
  const sameYear = d.getFullYear() === today.getFullYear();
  // "TUE · MAY 5" — day-of-week + month + day. Year only when not current.
  const fmt: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  };
  return d.toLocaleDateString('en-US', fmt).replace(',', ' ·');
}

