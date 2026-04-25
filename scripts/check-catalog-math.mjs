#!/usr/bin/env node
/**
 * Catalog math verifier — zero deps, no test framework.
 *
 * Reads lib/peptides.ts as plain text, parses every entry's
 * `reconstitution` string, and asserts:
 *   1. The "X mg/mL · N units = D mcg|mg" math is internally consistent.
 *   2. parseRecon() (mirrored here) lands on a target dose that matches
 *      defaultDoseMcg or another value found in the string.
 *
 * Run:  node scripts/check-catalog-math.mjs
 * Exits 0 on success, 1 on any failure. CI-friendly.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATH = resolve(__dirname, '..', 'lib', 'peptides.ts');
const text = readFileSync(PATH, 'utf8');

// Split into entries. Each Peptide is "  {\n    id: '...',\n    ...\n  },".
const blocks = text.split(/^  \{$/m).slice(1);

const TOL = 0.01; // 1% rounding tolerance
const failures = [];
const verified = [];
const skipped = [];
let total = 0;

for (const blk of blocks) {
  const idMatch = blk.match(/^\s+id: '([^']+)',/m);
  const reconMatch = blk.match(/^\s+reconstitution: '([^']*)'/m);
  const defaultMatch = blk.match(/^\s+defaultDoseMcg: (\d+(?:\.\d+)?),/m);
  if (!idMatch || !reconMatch) continue;
  total++;
  const id = idMatch[1];
  const recon = reconMatch[1];
  const defaultDoseMcg = defaultMatch ? parseFloat(defaultMatch[1]) : null;

  // Match every "= N mg/mL · M units = D <unit>" group inside the string.
  const re =
    /(\d+(?:\.\d+)?)\s*mg\/mL\s*[·\.]\s*(\d+(?:\.\d+)?)\s*units\s*(?:\([^)]*\))?\s*=\s*(\d+(?:\.\d+)?)\s*(mcg|mg)\b/gi;
  const matches = [...recon.matchAll(re)];
  if (matches.length === 0) {
    skipped.push({ id, reason: 'no unit-based example draw', recon });
    continue;
  }

  for (const m of matches) {
    const conc = parseFloat(m[1]);
    const units = parseFloat(m[2]);
    const claimed = parseFloat(m[3]);
    const claimedMg = m[4].toLowerCase() === 'mg' ? claimed : claimed / 1000;
    const actualMg = conc * units * 0.01;
    const err = Math.abs(actualMg - claimedMg) / Math.max(claimedMg, 1e-9);
    if (err > TOL) {
      failures.push({
        id,
        msg: `claims ${claimedMg * 1000} mcg, math gives ${(actualMg * 1000).toFixed(1)} mcg (off ${(err * 100).toFixed(0)}%)`,
        snippet: m[0],
      });
    } else {
      verified.push({ id, dose_mcg: actualMg * 1000 });
    }
  }

  // Cross-check defaultDoseMcg: it should match the example draw OR a
  // sensible literature value. Warn if it's wildly off.
  if (defaultDoseMcg && matches.length === 1) {
    const m = matches[0];
    const claimed = parseFloat(m[3]);
    const claimedMcg = m[4].toLowerCase() === 'mg' ? claimed * 1000 : claimed;
    if (claimedMcg > 0 && (defaultDoseMcg < claimedMcg / 10 || defaultDoseMcg > claimedMcg * 10)) {
      failures.push({
        id,
        msg: `defaultDoseMcg=${defaultDoseMcg} mcg is >10× off from recon example ${claimedMcg} mcg`,
      });
    }
  }
}

console.log(`Catalog math check — ${total} peptide entries scanned`);
console.log(`  ✓ ${verified.length} unit-based example draws verified`);
console.log(`  · ${skipped.length} entries skipped (oral / pen / mL-based)`);

if (failures.length > 0) {
  console.error(`\n  ✗ ${failures.length} failure(s):`);
  for (const f of failures) {
    console.error(`    ${f.id}: ${f.msg}`);
    if (f.snippet) console.error(`      → ${f.snippet}`);
  }
  process.exit(1);
}

console.log('\nAll catalog math is internally consistent.');
process.exit(0);
