#!/usr/bin/env node
/**
 * Frequency-coverage verifier.
 *
 * For every peptide in lib/peptides.ts, runs the freq string through
 * describeFreq() and renders the same vial-life label the user would see
 * on the Reconstitute screen. Flags entries whose freq parses to the
 * fallback case (label === freq) or to "as-needed" when a researcher would
 * reasonably expect a cadence — letting the auditor eyeball the full set.
 *
 *   node scripts/check-freq-coverage.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATH = resolve(__dirname, '..', 'lib', 'peptides.ts');
const text = readFileSync(PATH, 'utf8');

// Inline copy of describeFreq mirroring lib/freq.ts. When that helper
// changes, update this too. (Or extract it to a single .mjs both can
// import — for now, duplication keeps the script zero-dep.)
function describeFreq(freq) {
  const raw = (freq ?? '').toLowerCase().trim();
  let f = raw.replace(/titrated\s+(daily|weekly|every\s+\w+)/g, ' ');
  f = f.replace(/\([^)]*\)/g, ' ');
  const semi = f.indexOf(';');
  if (semi >= 0) f = f.slice(0, semi);
  f = f.replace(/\s+/g, ' ').trim();

  // N-on/M-off: "5 on / 2 off", "5-on/2-off", "5 on 2 off", "5/2".
  const onOff =
    f.match(/(\d+)\s*-?\s*on\s*(?:[/,-]|\s)\s*(\d+)\s*-?\s*off/) ||
    (/^(\d+)\s*\/\s*(\d+)$/.exec(f));
  if (onOff) {
    const on = parseInt(onOff[1], 10);
    const off = parseInt(onOff[2], 10);
    if (on > 0 && off > 0) {
      const period = on + off;
      return {
        perDay: on / period, daysPerDose: period / on,
        displayUnit: 'days', label: `${on}-on/${off}-off`,
      };
    }
  }

  const hasCadence =
    /\b(daily|nightly|weekly|every other day|eod|per\s*week|per\s*day|once|twice|thrice|×|x)\s*(daily|weekly|day|week|night|nightly)?/i.test(f) ||
    /\b(once|twice|thrice|1×|2×|3×|1x|2x|3x|[1-9]–[1-9][×x])\s*(daily|weekly)/i.test(f);

  if (!hasCadence) {
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

  // Range patterns first so "1–2× daily" doesn't match "2× daily" below.
  const dailyRange = f.match(/(\d)\s*[–-]\s*(\d)\s*[×x]\s*daily/);
  if (dailyRange) {
    const lo = parseInt(dailyRange[1], 10);
    const hi = parseInt(dailyRange[2], 10);
    if (lo > 0 && hi >= lo) {
      return {
        perDay: hi, daysPerDose: 1 / hi, displayUnit: 'days',
        label: `${lo}-${hi}/day`, lowerPerDay: lo, upperPerDay: hi,
      };
    }
  }
  const weeklyRange = f.match(/(\d)\s*[–-]\s*(\d)\s*[×x]\s*weekly/);
  if (weeklyRange) {
    const lo = parseInt(weeklyRange[1], 10);
    const hi = parseInt(weeklyRange[2], 10);
    if (lo > 0 && hi >= lo) {
      return {
        perDay: hi / 7, daysPerDose: 7 / hi, displayUnit: 'weeks',
        label: `${lo}-${hi}/week`, lowerPerDay: lo / 7, upperPerDay: hi / 7,
      };
    }
  }
  if (f.includes('twice daily') || /\b2[x×]\s*daily/.test(f) || /\b2\s+per\s*day/.test(f))
    return { perDay: 2, daysPerDose: 0.5, displayUnit: 'days', label: '2/day' };
  if (/\b3[x×]\s*daily/.test(f) || f.includes('three times daily'))
    return { perDay: 3, daysPerDose: 1 / 3, displayUnit: 'days', label: '3/day' };
  if (f.includes('twice weekly') || /\b2[x×]\s*week/.test(f) || /\b2\s*\/\s*week/.test(f) || /\b2\s+per\s*week/.test(f))
    return { perDay: 2 / 7, daysPerDose: 7 / 2, displayUnit: 'weeks', label: '2/week' };
  if (/\b3[x×]\s*week/.test(f) || /\b3\s*\/\s*week/.test(f) || /\b3\s+per\s*week/.test(f) || f.includes('three times weekly'))
    return { perDay: 3 / 7, daysPerDose: 7 / 3, displayUnit: 'weeks', label: '3/week' };
  if (/\b1\s*[–-]\s*2[×x]\s*(per\s*)?week/.test(f))
    return { perDay: 2 / 7, daysPerDose: 7 / 2, displayUnit: 'weeks', label: '1–2/week' };
  if (f.includes('every other day') || f.includes('eod'))
    return { perDay: 0.5, daysPerDose: 2, displayUnit: 'days', label: 'every other day' };
  if (f.includes('once weekly') || /\b1[x×]\s*weekly/.test(f) || f.includes('once / week') || f.includes('1 per week'))
    return { perDay: 1 / 7, daysPerDose: 7, displayUnit: 'weeks', label: 'weekly' };
  if (f.includes('once daily') || /\b1[x×]\s*daily/.test(f) || f.includes('nightly') || f.includes('once a day'))
    return { perDay: 1, daysPerDose: 1, displayUnit: 'days', label: 'daily' };
  if (f.includes('weekly') && !f.includes('daily'))
    return { perDay: 1 / 7, daysPerDose: 7, displayUnit: 'weeks', label: 'weekly' };
  if (f.includes('daily') || f.includes('per-training') || f.includes('per training'))
    return { perDay: 1, daysPerDose: 1, displayUnit: 'days', label: 'daily' };
  return { perDay: 1, daysPerDose: 1, displayUnit: 'days', label: raw || 'daily' };
}

function formatDuration(totalDoses, freq) {
  const shape = describeFreq(freq);
  const n = Math.floor(totalDoses);
  if (shape.perDay === 0) return `~${n} doses (as-needed)`;
  if (shape.lowerPerDay !== undefined && shape.upperPerDay !== undefined && shape.lowerPerDay !== shape.upperPerDay) {
    if (shape.displayUnit === 'weeks') {
      const upperWeeks = Math.floor(n / (shape.upperPerDay * 7));
      const lowerWeeks = Math.floor(n / (shape.lowerPerDay * 7));
      if (upperWeeks === lowerWeeks) return `~${upperWeeks} week${upperWeeks === 1 ? '' : 's'} @ ${shape.label}`;
      return `~${upperWeeks}-${lowerWeeks} weeks @ ${shape.label}`;
    }
    const upperDays = Math.floor(n / shape.upperPerDay);
    const lowerDays = Math.floor(n / shape.lowerPerDay);
    if (upperDays === lowerDays) return `~${upperDays} day${upperDays === 1 ? '' : 's'} @ ${shape.label}`;
    return `~${upperDays}-${lowerDays} days @ ${shape.label}`;
  }
  const totalDays = n * shape.daysPerDose;
  if (shape.displayUnit === 'weeks') {
    const weeks = Math.floor(totalDays / 7);
    return `~${weeks} week${weeks === 1 ? '' : 's'} @ ${shape.label}`;
  }
  return `~${Math.floor(totalDays)} day${totalDays === 1 ? '' : 's'} @ ${shape.label}`;
}

const blocks = text.split(/^  \{$/m).slice(1);

const rows = [];
let fallback = 0;
let asNeeded = 0;

for (const blk of blocks) {
  const id = (blk.match(/^\s+id: '([^']+)',/m) || [])[1];
  const freq = (blk.match(/^\s+freq: '([^']*)',/m) || [])[1];
  if (!id) continue;
  const shape = describeFreq(freq);
  const example10 = formatDuration(10, freq);
  const isFallback = shape.label === (freq ?? '').toLowerCase().trim() && shape.label !== 'daily';
  const isAsNeeded = shape.perDay === 0;
  if (isFallback) fallback++;
  if (isAsNeeded) asNeeded++;
  rows.push({ id, freq, label: shape.label, example10, isFallback, isAsNeeded });
}

const pad = (s, n) => String(s).padEnd(n, ' ');

console.log('Per-peptide frequency parse + 10-dose example output:\n');
console.log(pad('id', 14), pad('freq (input)', 60), pad('parsed', 18), pad('example: 10 doses', 30));
console.log('-'.repeat(125));
for (const r of rows) {
  const flag = r.isFallback ? '⚠ FALLBACK ' : r.isAsNeeded ? '— as-needed ' : '           ';
  console.log(
    flag,
    pad(r.id, 14),
    pad('"' + r.freq.slice(0, 56) + (r.freq.length > 56 ? '…' : '') + '"', 60),
    pad(r.label, 18),
    pad(r.example10, 30),
  );
}

console.log();
console.log(`scanned: ${rows.length}`);
console.log(`as-needed (no schedule):  ${asNeeded}`);
console.log(`fallback (uncategorized): ${fallback}`);
if (fallback > 0) {
  console.error('\n  ✗ At least one peptide fell through to the generic fallback.');
  console.error('    Add a matching keyword branch in lib/freq.ts.');
  process.exit(1);
}
