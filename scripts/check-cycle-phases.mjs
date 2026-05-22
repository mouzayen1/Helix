#!/usr/bin/env node
/**
 * Phase-resolver + N-on/M-off frequency verifier.
 *
 * Exercises the math behind lib/cycle-helpers.ts's resolvePhase() and
 * isItemScheduledOnDay(), plus lib/freq.ts's N-on/M-off branch. Runs as
 * part of `npm run check` so off-by-one bugs in cycle-week math get
 * caught before they reach Today's schedule or the notification
 * scheduler.
 *
 * Inline copies of describeFreq + isScheduledOnDay + resolvePhase mirror
 * the production helpers; when those change, update this too. (Same
 * trade-off as scripts/check-freq-coverage.mjs.)
 *
 *   node scripts/check-cycle-phases.mjs
 */

// ── inline freq helpers (mirror lib/freq.ts) ──────────────────────────────
function describeFreq(freq) {
  const raw = (freq ?? '').toLowerCase().trim();
  let f = raw.replace(/titrated\s+(daily|weekly|every\s+\w+)/g, ' ');
  f = f.replace(/\([^)]*\)/g, ' ');
  const semi = f.indexOf(';');
  if (semi >= 0) f = f.slice(0, semi);
  f = f.replace(/\s+/g, ' ').trim();

  const onOff =
    f.match(/(\d+)\s*-?\s*on\s*(?:[/,-]|\s)\s*(\d+)\s*-?\s*off/) ||
    /^(\d+)\s*\/\s*(\d+)$/.exec(f);
  if (onOff) {
    const on = parseInt(onOff[1], 10);
    const off = parseInt(onOff[2], 10);
    if (on > 0 && off > 0) {
      return {
        perDay: on / (on + off),
        daysPerDose: (on + off) / on,
        displayUnit: 'days',
        label: `${on}-on/${off}-off`,
      };
    }
  }

  const hasCadence =
    /\b(daily|nightly|weekly|every other day|eod|per\s*week|per\s*day|once|twice|thrice|×|x)\s*(daily|weekly|day|week|night|nightly)?/i.test(f) ||
    /\b(once|twice|thrice|1×|2×|3×|1x|2x|3x|[1-9]–[1-9][×x])\s*(daily|weekly)/i.test(f);
  if (!hasCadence) {
    if (f === '') return { perDay: 0, daysPerDose: 0, displayUnit: 'days', label: 'as-needed' };
    return { perDay: 1, daysPerDose: 1, displayUnit: 'days', label: raw || 'daily' };
  }
  if (f.includes('twice daily') || /\b2[x×]\s*daily/.test(f))
    return { perDay: 2, daysPerDose: 0.5, displayUnit: 'days', label: '2/day' };
  if (f.includes('every other day') || f.includes('eod'))
    return { perDay: 0.5, daysPerDose: 2, displayUnit: 'days', label: 'every other day' };
  if (f.includes('once weekly') || /\b1[x×]\s*weekly/.test(f))
    return { perDay: 1 / 7, daysPerDose: 7, displayUnit: 'weeks', label: 'weekly' };
  if (f.includes('once daily') || /\b1[x×]\s*daily/.test(f) || f.includes('nightly'))
    return { perDay: 1, daysPerDose: 1, displayUnit: 'days', label: 'daily' };
  if (f.includes('weekly') && !f.includes('daily'))
    return { perDay: 1 / 7, daysPerDose: 7, displayUnit: 'weeks', label: 'weekly' };
  if (f.includes('daily'))
    return { perDay: 1, daysPerDose: 1, displayUnit: 'days', label: 'daily' };
  return { perDay: 1, daysPerDose: 1, displayUnit: 'days', label: raw || 'daily' };
}

function isScheduledOnDay(freq, dayOfCycle) {
  const shape = describeFreq(freq);
  if (shape.perDay === 0) return false;
  const m = /^(\d+)-on\/(\d+)-off$/.exec(shape.label);
  if (m) {
    const on = parseInt(m[1], 10);
    const off = parseInt(m[2], 10);
    return dayOfCycle % (on + off) < on;
  }
  if (shape.daysPerDose <= 1) return true;
  if (shape.label === '2/week') return dayOfCycle % 7 === 0 || dayOfCycle % 7 === 3;
  if (shape.label === '3/week')
    return dayOfCycle % 7 === 0 || dayOfCycle % 7 === 2 || dayOfCycle % 7 === 4;
  const period = Math.round(shape.daysPerDose);
  return dayOfCycle % Math.max(1, period) === 0;
}

// ── inline phase resolver (mirror lib/cycle-helpers.ts) ──────────────────
function resolvePhase(item, dayOfCycle) {
  const day = Math.max(0, Math.floor(dayOfCycle));
  const currentWeek = Math.floor(day / 7) + 1;
  const phases = (item.phases ?? []).slice().sort((a, b) => a.startWeek - b.startWeek);
  if (phases.length < 2) {
    return {
      freq: item.freq,
      dose_mcg: item.dose_mcg,
      phaseIndex: 0,
      weekInPhase: currentWeek,
      totalPhaseWeeks: Infinity,
      phaseCount: phases.length === 1 ? 1 : 1,
      phaseStartDay: 0,
    };
  }
  let activeIdx = 0;
  for (let i = 0; i < phases.length; i++) {
    if (phases[i].startWeek <= currentWeek) activeIdx = i;
  }
  const active = phases[activeIdx];
  const next = phases[activeIdx + 1];
  return {
    freq: active.freq,
    dose_mcg: active.dose_mcg ?? item.dose_mcg,
    phaseName: active.name,
    phaseIndex: activeIdx,
    weekInPhase: Math.max(1, currentWeek - active.startWeek + 1),
    totalPhaseWeeks: next ? next.startWeek - active.startWeek : Infinity,
    phaseCount: phases.length,
    phaseStartDay: (active.startWeek - 1) * 7,
  };
}

function isItemScheduledOnDay(item, day) {
  const rp = resolvePhase(item, day);
  return isScheduledOnDay(rp.freq, day - rp.phaseStartDay);
}

// ── tiny test runner ─────────────────────────────────────────────────────
let pass = 0;
let fail = 0;
const failures = [];
function it(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ✓', name);
  } catch (err) {
    fail++;
    failures.push({ name, err });
    console.log('  ✗', name);
    console.log('    ', err.message);
  }
}
function assertEq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg ?? 'assertEq'}: expected ${e}, got ${a}`);
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg ?? 'assertion failed');
}

console.log('lib/cycle-helpers.ts + lib/freq.ts — phase resolver + N-on/M-off:\n');

// 1. Empty / absent phases → legacy fallback
it('resolvePhase with absent phases returns legacy fallback', () => {
  const item = { peptide_id: 'x', dose_mcg: 100, freq: 'daily', time_of_day: 'AM' };
  const rp = resolvePhase(item, 0);
  assertEq(rp.freq, 'daily');
  assertEq(rp.dose_mcg, 100);
  assertEq(rp.phaseCount, 1);
  assertEq(rp.phaseIndex, 0);
  assertEq(rp.phaseStartDay, 0);
});

it('resolvePhase with empty phases array returns legacy fallback', () => {
  const item = { peptide_id: 'x', dose_mcg: 100, freq: 'daily', time_of_day: 'AM', phases: [] };
  const rp = resolvePhase(item, 100);
  assertEq(rp.freq, 'daily');
  assertEq(rp.phaseCount, 1);
});

// 2. Week-8 → week-9 boundary
it('resolvePhase at the week-8 / week-9 boundary picks the right phase', () => {
  const item = {
    peptide_id: 'tesa',
    dose_mcg: 2000,
    freq: 'daily',
    time_of_day: 'AM',
    phases: [
      { startWeek: 1, name: 'Daily', freq: 'daily' },
      { startWeek: 9, name: 'Maintenance', freq: '5 on / 2 off' },
    ],
  };
  // day 55 = end of week 8 (week 8 day 7)
  const rpA = resolvePhase(item, 55);
  assertEq(rpA.phaseIndex, 0, 'day 55 should still be phase 1');
  assertEq(rpA.freq, 'daily');
  // day 56 = start of week 9
  const rpB = resolvePhase(item, 56);
  assertEq(rpB.phaseIndex, 1, 'day 56 should switch to phase 2');
  assertEq(rpB.freq, '5 on / 2 off');
  assertEq(rpB.weekInPhase, 1);
  assertEq(rpB.phaseStartDay, 56);
});

// 3. Out-of-order phases (defensive sort)
it('resolvePhase tolerates out-of-order phase arrays', () => {
  const sorted = {
    peptide_id: 'x', dose_mcg: 0, freq: 'daily', time_of_day: 'AM',
    phases: [
      { startWeek: 1, freq: 'daily' },
      { startWeek: 9, freq: '5 on / 2 off' },
    ],
  };
  const reversed = { ...sorted, phases: [...sorted.phases].reverse() };
  for (const day of [0, 30, 56, 100]) {
    assertEq(resolvePhase(reversed, day), resolvePhase(sorted, day),
      `defensive sort must produce identical resolver output @ day ${day}`);
  }
});

// 4. 14-day on/off pattern
it('isItemScheduledOnDay produces [T,T,T,T,T,F,F,T,T,T,T,T,F,F] for 5-on/2-off', () => {
  const item = {
    peptide_id: 'x', dose_mcg: 0, freq: '5 on / 2 off', time_of_day: 'AM',
  };
  const arr = Array.from({ length: 14 }, (_, d) => isItemScheduledOnDay(item, d));
  const expected = [true,true,true,true,true,false,false, true,true,true,true,true,false,false];
  assertEq(arr, expected);
});

// 5. Phase boundary day belongs to exactly one phase
it('a phase boundary day belongs to exactly one phase', () => {
  const item = {
    peptide_id: 'x', dose_mcg: 0, freq: 'daily', time_of_day: 'AM',
    phases: [
      { startWeek: 1, freq: 'daily' },
      { startWeek: 9, freq: '5 on / 2 off' },
    ],
  };
  // day 55 is the LAST day of phase 1 (since phase 2 starts at day 56)
  assertEq(resolvePhase(item, 55).phaseIndex, 0);
  assertEq(resolvePhase(item, 56).phaseIndex, 1);
});

// 6. 7-day notification window spanning a phase boundary
it('7-day notification window spanning a phase boundary picks correct phase per day', () => {
  const item = {
    peptide_id: 'x', dose_mcg: 0, freq: 'daily', time_of_day: 'AM',
    phases: [
      { startWeek: 1, freq: 'daily' },
      { startWeek: 9, freq: '5 on / 2 off' },
    ],
  };
  // simulate: today is day 55 (last day of phase 1); schedule next 7 days
  const todayDay = 55;
  const phases = [];
  for (let off = 0; off < 7; off++) {
    phases.push(resolvePhase(item, todayDay + off).phaseIndex);
  }
  assertEq(phases, [0, 1, 1, 1, 1, 1, 1]);

  // and the 5-on/2-off rhythm relative to phase 2's start should fire on
  // days 56..60 (offsets 1..5) and skip 61, 62 (offsets 6, 7)
  const fires = [];
  for (let off = 0; off < 8; off++) {
    fires.push(isItemScheduledOnDay(item, todayDay + off));
  }
  assertEq(fires, [true, true, true, true, true, true, false, false]);
});

// 7. describeFreq normalization for the three N-on/M-off forms
it('describeFreq normalizes 5-on/2-off in three string forms', () => {
  const a = describeFreq('5 on 2 off');
  const b = describeFreq('5-on/2-off');
  const c = describeFreq('5/2');
  assertEq(a, b, 'space-form vs hyphen-slash-form must match');
  assertEq(a, c, 'space-form vs bare-fraction-form must match');
  assertEq(a.label, '5-on/2-off');
});

// 8. isScheduledOnDay raw 5-on/2-off pattern (without phases)
it('isScheduledOnDay("5 on 2 off", d) for d=0..13 matches the reference', () => {
  const arr = Array.from({ length: 14 }, (_, d) => isScheduledOnDay('5 on 2 off', d));
  const expected = [true,true,true,true,true,false,false, true,true,true,true,true,false,false];
  assertEq(arr, expected);
});

console.log();
console.log(`passed: ${pass}`);
console.log(`failed: ${fail}`);
if (fail > 0) {
  console.error('\n  ✗ Phase-resolver regressions detected. See lib/cycle-helpers.ts + lib/freq.ts.');
  process.exit(1);
}
