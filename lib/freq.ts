// Single source of truth for frequency math. Anywhere in the app that asks
// "how often does this dose happen?" goes through these helpers — vial-life
// estimates, cycle-day scheduling, notification scheduling, etc. — so a fix
// in one place fixes everything.
//
// Inputs are the freq strings users type (or that come from cycle templates):
//   "daily", "twice daily", "every other day", "weekly", "twice weekly",
//   "pre-workout" (PRN), "Once weekly", "Once daily (titrated weekly)".
// Strings are matched case-insensitively against keywords; unknown values
// default to once-daily so estimators degrade gracefully.

export type FreqShape = {
  perDay: number;       // 1 = once a day, 2 = twice, 1/7 ≈ weekly, 0 = PRN
  daysPerDose: number;  // inverse of perDay (1 for daily, 7 for weekly)
  // The "natural" unit a UI should use to display the cadence.
  // Daily-cadence schedules display in days; weekly schedules in weeks.
  displayUnit: 'days' | 'weeks';
  // Compact human-readable form for "every X" labels.
  label: string;
  // v1.2.3: when the freq itself expresses a range (e.g. "1–2× daily",
  // "2–3× weekly"), these capture both bounds so the vial-life
  // estimator can render "~2-5 days @ 1-2/day". perDay still equals
  // upperPerDay for the conservative planning case (over-estimate
  // cadence → under-estimate vial life → user buys/preps more, not
  // less). Undefined means a single-cadence freq.
  lowerPerDay?: number;
  upperPerDay?: number;
};

export function describeFreq(freq: string | null | undefined): FreqShape {
  const raw = (freq ?? '').toLowerCase().trim();

  // ----- Normalize -------------------------------------------------------
  // 1. "titrated weekly / titrated daily" describes how the dose escalates,
  //    NOT the dosing cadence. Strip it before keyword matching so
  //    Liraglutide ("Once daily (titrated weekly)") doesn't get misread
  //    as a weekly drug.
  // 2. Drop parentheticals — they're almost always footnotes / alternative
  //    protocols / unit clarifications, not the primary cadence.
  // 3. Take only the FIRST clause before a semicolon. Multi-clause freqs
  //    like "Once weekly (SubQ); Once daily fasting (oral)" need a single
  //    answer; the leading clause is the one most users actually follow.
  let f = raw.replace(/titrated\s+(daily|weekly|every\s+\w+)/g, ' ');
  f = f.replace(/\([^)]*\)/g, ' ');
  const semi = f.indexOf(';');
  if (semi >= 0) f = f.slice(0, semi);
  f = f.replace(/\s+/g, ' ').trim();

  // ----- N-on / M-off ----------------------------------------------------
  // Pulsed schedules: "5 on / 2 off", "5-on/2-off", "5 on 2 off", "5/2".
  // Counts from the cycle (or phase) start day, NOT the calendar week — a
  // phase that begins on a Wednesday starts its "on" window on Wednesday.
  // perDay = N/(N+M), daysPerDose = (N+M)/N for vial-life math; the on/off
  // pattern itself is enforced by isScheduledOnDay below.
  const onOff =
    f.match(/(\d+)\s*-?\s*on\s*(?:[/,-]|\s)\s*(\d+)\s*-?\s*off/) ||
    (/^(\d+)\s*\/\s*(\d+)$/.exec(f));
  if (onOff) {
    const on = parseInt(onOff[1], 10);
    const off = parseInt(onOff[2], 10);
    if (on > 0 && off > 0) {
      const period = on + off;
      return {
        perDay: on / period,
        daysPerDose: period / on,
        displayUnit: 'days',
        label: `${on}-on/${off}-off`,
      };
    }
  }

  // hasCadence: at least one frequency-keyword survived the cleaning.
  // Only when no keyword is present do we treat this as "as-needed" — that
  // way "Daily during loading … then as-needed" still parses as daily, and
  // "Nightly as needed" still parses as nightly.
  const hasCadence =
    /\b(daily|nightly|weekly|every other day|eod|per\s*week|per\s*day|once|twice|thrice|×|x)\s*(daily|weekly|day|week|night|nightly)?/i.test(
      f
    ) ||
    /\b(once|twice|thrice|1×|2×|3×|1x|2x|3x|[1-9]–[1-9][×x])\s*(daily|weekly)/i.test(f);

  if (!hasCadence) {
    // Pure "as-needed" / unspecified — return 0 perDay so callers skip
    // duration math entirely.
    if (
      f === '' || raw.includes('pre-workout') || raw.includes('as needed') ||
      raw.includes('as-needed') || raw.includes('prn') ||
      raw.includes('single dose') || raw.includes('single-dose') ||
      raw.includes('varies') || raw.includes('cycled') || raw.includes('variable')
    ) {
      return { perDay: 0, daysPerDose: 0, displayUnit: 'days', label: 'as-needed' };
    }
    return { perDay: 1, daysPerDose: 1, displayUnit: 'days', label: raw || 'daily' };
  }

  // ----- Match specific patterns first ----------------------------------
  // Range patterns FIRST so "1–2× daily" doesn't match the "2× daily"
  // single-cadence rule below and lose the lower-bound information.
  // The label keeps the range visible to users; perDay/daysPerDose use
  // the upper bound for conservative vial-life math.
  const dailyRange = f.match(/(\d)\s*[–-]\s*(\d)\s*[×x]\s*daily/);
  if (dailyRange) {
    const lo = parseInt(dailyRange[1], 10);
    const hi = parseInt(dailyRange[2], 10);
    if (lo > 0 && hi >= lo) {
      return {
        perDay: hi,
        daysPerDose: 1 / hi,
        displayUnit: 'days',
        label: `${lo}-${hi}/day`,
        lowerPerDay: lo,
        upperPerDay: hi,
      };
    }
  }
  const weeklyRange = f.match(/(\d)\s*[–-]\s*(\d)\s*[×x]\s*weekly/);
  if (weeklyRange) {
    const lo = parseInt(weeklyRange[1], 10);
    const hi = parseInt(weeklyRange[2], 10);
    if (lo > 0 && hi >= lo) {
      return {
        perDay: hi / 7,
        daysPerDose: 7 / hi,
        displayUnit: 'weeks',
        label: `${lo}-${hi}/week`,
        lowerPerDay: lo / 7,
        upperPerDay: hi / 7,
      };
    }
  }

  // Twice-daily before generic "daily".
  if (f.includes('twice daily') || /\b2[x×]\s*daily/.test(f) || /\b2\s+per\s*day/.test(f)) {
    return { perDay: 2, daysPerDose: 0.5, displayUnit: 'days', label: '2/day' };
  }
  // 3× daily fallback — bare "3× daily" with no lower bound.
  if (
    /\b[1-9]\s*[–-]\s*[1-9][×x]\s*daily/.test(f) ||
    /\b3[x×]\s*daily/.test(f) ||
    f.includes('three times daily')
  ) {
    // Use the upper-bound 3/day for vial-life math so estimates lean
    // conservative — if a user is dosing 1-3× daily, the safer planning
    // assumption is 3×.
    return { perDay: 3, daysPerDose: 1 / 3, displayUnit: 'days', label: 'multiple/day' };
  }

  // Twice / 2× / 2-per weekly
  if (
    f.includes('twice weekly') ||
    /\b2[x×]\s*week/.test(f) ||
    /\b2\s*\/\s*week/.test(f) ||
    /\b2\s+per\s*week/.test(f)
  ) {
    return { perDay: 2 / 7, daysPerDose: 7 / 2, displayUnit: 'weeks', label: '2/week' };
  }
  // 2–3× / 3× weekly bucket. Display in weeks but show ≥3/week label so
  // the user sees the upper-bound vial-life estimate.
  if (
    /\b[2-3]\s*[–-]\s*[2-3][×x]\s*weekly/.test(f) ||
    /\b3[x×]\s*week/.test(f) ||
    /\b3\s*\/\s*week/.test(f) ||
    /\b3\s+per\s*week/.test(f) ||
    f.includes('three times weekly')
  ) {
    return { perDay: 3 / 7, daysPerDose: 7 / 3, displayUnit: 'weeks', label: '3/week' };
  }
  // 1–2× per week — the slower end of variable weekly. Use 2/week as the
  // upper-bound model (covers "1–2× weekly during loading, then weekly").
  if (/\b1\s*[–-]\s*2[×x]\s*(per\s*)?week/.test(f)) {
    return { perDay: 2 / 7, daysPerDose: 7 / 2, displayUnit: 'weeks', label: '1–2/week' };
  }

  if (f.includes('every other day') || f.includes('eod')) {
    return { perDay: 0.5, daysPerDose: 2, displayUnit: 'days', label: 'every other day' };
  }

  // Specific "once weekly" before generic "weekly" so it always wins over
  // any stray "weekly" elsewhere in the cleaned string.
  if (
    f.includes('once weekly') ||
    /\b1[x×]\s*weekly/.test(f) ||
    f.includes('once / week') ||
    f.includes('1 per week')
  ) {
    return { perDay: 1 / 7, daysPerDose: 7, displayUnit: 'weeks', label: 'weekly' };
  }

  // Specific "once daily" / nightly before generic "daily".
  if (
    f.includes('once daily') ||
    /\b1[x×]\s*daily/.test(f) ||
    f.includes('nightly') ||
    f.includes('once a day')
  ) {
    return { perDay: 1, daysPerDose: 1, displayUnit: 'days', label: 'daily' };
  }

  // Generic weekly — only when no daily indicator coexists. ("Weekly to
  // daily SubQ" should resolve to daily — the upper-cadence end is what
  // a fresh vial would actually fund.)
  if (f.includes('weekly') && !f.includes('daily')) {
    return { perDay: 1 / 7, daysPerDose: 7, displayUnit: 'weeks', label: 'weekly' };
  }

  // Generic daily — covers "Daily for 10–20 days", "Daily SubQ or topical",
  // "Daily during loading", "Daily or per-training-session", and the
  // weekly-to-daily upper bound.
  if (
    f.includes('daily') ||
    f.includes('per-training') ||
    f.includes('per training')
  ) {
    return { perDay: 1, daysPerDose: 1, displayUnit: 'days', label: 'daily' };
  }

  // Final fallback — should be unreachable given the hasCadence gate above.
  return { perDay: 1, daysPerDose: 1, displayUnit: 'days', label: raw || 'daily' };
}

// Returns true when a protocol row (with a freq string) is "scheduled" on
// the given 0-indexed day of a cycle. Centralizes the schedule math used by
// the Today screen and the local-notification scheduler.
export function isScheduledOnDay(freq: string | null | undefined, dayOfCycle: number): boolean {
  const shape = describeFreq(freq);
  if (shape.perDay === 0) return false;
  // N-on/M-off: first N days of each (N+M)-day window are "on".
  // Match the label ahead of the daily fall-through because daysPerDose
  // here is fractional (1.4 for 5/2) — the daily rule below would treat
  // it as on every day.
  const onOff = /^(\d+)-on\/(\d+)-off$/.exec(shape.label);
  if (onOff) {
    const on = parseInt(onOff[1], 10);
    const off = parseInt(onOff[2], 10);
    return dayOfCycle % (on + off) < on;
  }
  if (shape.daysPerDose <= 1) return true; // daily / twice-daily
  // Weekly / EOD / twice-weekly land on specific days of the cycle.
  // Twice-weekly: days 0 and 3 of each 7-day window (Mon + Thu spacing).
  if (shape.label === '2/week') {
    return dayOfCycle % 7 === 0 || dayOfCycle % 7 === 3;
  }
  if (shape.label === '3/week') {
    return dayOfCycle % 7 === 0 || dayOfCycle % 7 === 2 || dayOfCycle % 7 === 4;
  }
  // Generic case: every Nth day, anchored at day 0.
  const period = Math.round(shape.daysPerDose);
  return dayOfCycle % Math.max(1, period) === 0;
}

// Format a "vial-life" estimate from total doses and a freq string, picking
// the most readable unit. Examples:
//   (10, 'daily')        -> "~10 days @ daily"
//   (10, 'weekly')       -> "~10 weeks @ weekly"
//   (10, 'twice daily')  -> "~5 days @ 2/day"
//   (10, 'pre-workout')  -> "~10 doses (as-needed)"
export function formatDuration(totalDoses: number, freq: string | null | undefined): string {
  const shape = describeFreq(freq);
  const n = Math.floor(totalDoses);
  if (shape.perDay === 0) return `~${n} doses (as-needed)`;

  // Range-aware: if the freq itself was a range like "1–2× daily", show
  // both bounds so the user sees both the optimistic and conservative
  // vial life. Tilde stays on both — both ends are estimates. Collapse
  // to a single value when both bounds round to the same display number
  // (e.g. lower=4.8d, upper=5.0d → "~5 days", not "~5-5 days").
  if (
    shape.lowerPerDay !== undefined &&
    shape.upperPerDay !== undefined &&
    shape.lowerPerDay !== shape.upperPerDay
  ) {
    if (shape.displayUnit === 'weeks') {
      const upperWeeks = Math.floor(n / (shape.upperPerDay * 7));
      const lowerWeeks = Math.floor(n / (shape.lowerPerDay * 7));
      if (upperWeeks === lowerWeeks) {
        return `~${upperWeeks} week${upperWeeks === 1 ? '' : 's'} @ ${shape.label}`;
      }
      return `~${upperWeeks}-${lowerWeeks} weeks @ ${shape.label}`;
    }
    const upperDays = Math.floor(n / shape.upperPerDay);
    const lowerDays = Math.floor(n / shape.lowerPerDay);
    if (upperDays === lowerDays) {
      return `~${upperDays} day${upperDays === 1 ? '' : 's'} @ ${shape.label}`;
    }
    return `~${upperDays}-${lowerDays} days @ ${shape.label}`;
  }

  const totalDays = n * shape.daysPerDose;
  if (shape.displayUnit === 'weeks') {
    const weeks = Math.floor(totalDays / 7);
    return `~${weeks} week${weeks === 1 ? '' : 's'} @ ${shape.label}`;
  }
  return `~${Math.floor(totalDays)} day${totalDays === 1 ? '' : 's'} @ ${shape.label}`;
}
