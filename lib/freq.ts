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
};

export function describeFreq(freq: string | null | undefined): FreqShape {
  const f = (freq ?? '').toLowerCase().trim();

  // PRN / unscheduled — return 0 perDay so callers can detect "no schedule"
  // and skip duration math entirely.
  if (
    f === '' ||
    f.includes('pre-workout') ||
    f.includes('as needed') ||
    f.includes('as-needed') ||
    f.includes('prn') ||
    f.includes('single dose') ||
    f.includes('single-dose') ||
    f.includes('varies') ||
    f.includes('cycled') ||
    f.includes('variable')
  ) {
    return { perDay: 0, daysPerDose: 0, displayUnit: 'days', label: 'as-needed' };
  }

  // Twice / 2× shapes first so "2x daily" doesn't fall through to "daily".
  if (f.includes('twice daily') || f.includes('2x daily') || f.includes('2× daily')) {
    return { perDay: 2, daysPerDose: 0.5, displayUnit: 'days', label: '2/day' };
  }
  if (f.includes('three times daily') || f.includes('3x daily') || f.includes('3× daily') || f.includes('1–3× daily') || f.includes('2–3× daily')) {
    return { perDay: 2, daysPerDose: 0.5, displayUnit: 'days', label: 'multiple/day' };
  }
  if (f.includes('twice weekly') || f.includes('2x week') || f.includes('2× week') || f.includes('2/week')) {
    return { perDay: 2 / 7, daysPerDose: 7 / 2, displayUnit: 'weeks', label: '2/week' };
  }
  if (f.includes('three times weekly') || f.includes('3x week') || f.includes('3× week') || f.includes('3/week')) {
    return { perDay: 3 / 7, daysPerDose: 7 / 3, displayUnit: 'weeks', label: '3/week' };
  }
  if (f.includes('every other day') || f.includes('eod')) {
    return { perDay: 0.5, daysPerDose: 2, displayUnit: 'days', label: 'every other day' };
  }
  if (f.includes('weekly') || f.includes('1× weekly') || f.includes('1x weekly') || f.includes('once weekly') || f.includes('once / week')) {
    return { perDay: 1 / 7, daysPerDose: 7, displayUnit: 'weeks', label: 'weekly' };
  }
  if (f.includes('nightly') || f.includes('daily') || f.includes('once daily') || f.includes('1× daily') || f.includes('1x daily')) {
    return { perDay: 1, daysPerDose: 1, displayUnit: 'days', label: 'daily' };
  }

  // Fallback: assume once daily but flag with a generic label so the UI
  // doesn't claim a precise cadence.
  return { perDay: 1, daysPerDose: 1, displayUnit: 'days', label: f || 'daily' };
}

// Returns true when a protocol row (with a freq string) is "scheduled" on
// the given 0-indexed day of a cycle. Centralizes the schedule math used by
// the Today screen and the local-notification scheduler.
export function isScheduledOnDay(freq: string | null | undefined, dayOfCycle: number): boolean {
  const shape = describeFreq(freq);
  if (shape.perDay === 0) return false;
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
  const totalDays = n * shape.daysPerDose;
  if (shape.displayUnit === 'weeks') {
    const weeks = Math.floor(totalDays / 7);
    return `~${weeks} week${weeks === 1 ? '' : 's'} @ ${shape.label}`;
  }
  return `~${Math.floor(totalDays)} day${totalDays === 1 ? '' : 's'} @ ${shape.label}`;
}
