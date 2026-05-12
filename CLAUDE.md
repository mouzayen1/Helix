# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Helix is a research-forward peptide education and tracking app. Expo SDK 54 + React Native 0.81 + TypeScript (strict). The local store is SQLite (`lib/db.ts`); identity, founders' tier, and cross-device sync live on Supabase. The local schema deliberately mirrors the Supabase schema so the sync layer (v1.1+) is a one-to-one mapping, not a translation.

The app ships a 43-peptide catalog with monographs (sequence, MW, half-life, dose range, reconstitution, mechanism, citations) and lets users run cycles, track vials, log doses, journal, and chart metrics. Sign-in is required from first launch via Apple / Google / Email; the first 100 unique signups receive permanent founder status with lifetime free access to future premium tiers.

## Commands

```bash
npm install
npx expo start              # dev — scan QR with Expo Go on Android
npm run android / ios / web
npm run lint                # expo lint (eslint-config-expo flat)
npm run check               # quality gate: types + catalog math + freq + phases
npm run check:types         # tsc --noEmit
npm run check:catalog       # node scripts/check-catalog-math.mjs
npm run check:freq          # node scripts/check-freq-coverage.mjs
npm run check:phases        # node scripts/check-cycle-phases.mjs

# Installable APK via EAS (preview channel, internal distribution).
# Native modules added with the auth feature (expo-apple-authentication,
# @react-native-google-signin/google-signin) mean OTA updates can no
# longer ship auth-related changes — those require a fresh build.
eas build --platform android --profile preview
```

Supabase migrations live in `supabase/migrations/*.sql` and are applied
by hand (Dashboard → SQL Editor) or via `psql $DATABASE_URL -f <file>`.
There is no in-tree CLI invocation; the Supabase MCP server, when
attached, can apply them directly.

Quality gate before pushing: `npm run check`. There is no test suite — the catalog/freq verifiers are the regression net for the 42-peptide data.

## Architecture

### Routing — expo-router (file-based)
`app/_layout.tsx` is the root: it boots SQLite (`initDatabase`), loads fonts, then mounts `RootGate` which redirects unfinished onboarding to `/welcome` and finished users to `/(tabs)`. It also re-runs `scheduleAllSafe()` on launch and on `AppState` foreground transitions, and checks for OTA updates (release builds only).

Route groups: `(onboarding)` (age-gate → terms → acknowledge → preferences → choose-path), `(tabs)` (Today / Library / Stacks / Progress). Modals are declared with `presentation: 'modal'`: `log-dose`, `reconstitute`, `log-metric`, `journal-entry`, `injection-sites`. Dynamic routes: `peptide/[id]`, `cycle/[id]`, `cycle/new`, `stack/[id]`, `stack/new`, `metric/[kind]`, `vials/[id]`.

Path alias: `@/*` → repo root (see `tsconfig.json`).

### Data layer — `lib/db.ts` (expo-sqlite)
Single SQLite file `helix.db`, opened lazily, WAL mode. `initDatabase()` runs `CREATE TABLE IF NOT EXISTS` + idempotent `addColumnIfMissing` migrations on every launch (safe for fresh installs and prior-version upgrades), then upserts the full PEPTIDES seed by id so monograph edits flow through to existing installs.

Tables (mirror Supabase schema in `supabase/migrations/`): `profile`, `peptides` (catalog, no `user_id`), `saved_peptides`, `vials`, `cycles`, `stacks`, `doses`, `journal_entries`, `metrics`, `injection_sites_log`, `dose_skips`. Every user-owned table carries a `user_id TEXT` column that filters reads/writes via the auth context (`setCurrentUserId` / `requireUserId` in `lib/db.ts`). The `peptides` reference table is global. See `docs/auth-migration-audit.md` for the full per-function audit.

When changing the schema: add a `CREATE TABLE IF NOT EXISTS` for new tables AND an `addColumnIfMissing` call for new columns on existing tables — never an `ALTER` without that helper, because users on prior versions will be upgrading in place. Mirror the same change to `supabase/migrations/` so the server schema stays in sync.

### Peptide catalog — `lib/peptides.ts` + `lib/peptide-extras/`
`lib/peptides.ts` is the canonical 42-entry catalog (the `Peptide` type is documented inline). Every entry must define `defaultDoseMcg` — log-dose, cycle-new, and cycle-edit consume it directly so the parser never has to guess from prose like "0.25–2.4 mg weekly".

The `reconstitution` string is parsed at runtime; its math is verified by `scripts/check-catalog-math.mjs` (regex-parses `N mg/mL · M units = D mcg|mg` examples and asserts internal consistency within 1% rounding tolerance). Edits to `reconstitution` strings should keep at least one parseable example draw.

Per-peptide UX extras (co-administration warnings, cycle templates, stack conflicts) live in `lib/peptide-extras/<class>.ts` (healing / immune / growth / metabolic / cognitive / longevity / misc), merged via `lib/peptide-extras/index.ts`. Splits exist solely for file size — not coupling — so add new peptides to the file matching their `class` field.

### Frequency math — `lib/freq.ts` (single source of truth)
`describeFreq()` is the only place that interprets freq strings ("daily", "twice weekly", "Once daily (titrated weekly)", "pre-workout", etc.). It returns `{ perDay, daysPerDose, displayUnit, label }` consumed by vial-life estimates, cycle scheduling, and notification scheduling. **A fix here fixes everything** — do not re-parse freq strings elsewhere.

Caveat: `scripts/check-freq-coverage.mjs` keeps an inline copy of `describeFreq` to stay zero-dep. When you change `lib/freq.ts`, mirror the change in the script (or extract both to a shared `.mjs` consumable by both runtimes).

### State / theming
- `lib/profile-context.tsx` — `ProfileProvider` exposes the singleton profile row with `refresh()` and `update(patch)`. Wraps everything below `RootGate`.
- `theme/ThemeContext.tsx` + `theme/tokens.ts` — `useTheme()` returns the active palette `t` plus `isDark`. Colors, radii, spacing, fonts all live in `tokens.ts`. Don't hardcode hex values in screens — pull from `t`.
- `zustand` is in deps but used sparingly; profile + theme are the main shared state.
- `components/Primitives.tsx` — shared UI primitives (`HTag`, `HSectionHeader`, etc.). Reuse before adding one-off styles.

### Notifications — `lib/notifications.ts`
All scheduling is local (no remote push). `scheduleAllSafe()` is idempotent: cancels all previously scheduled notifications and re-schedules from current `notif_prefs_json` + active cycle/vial state. Re-runs on launch and on foreground. If `prefs.mode === 'off'` or permission denied, it silently no-ops.

### Auth — `lib/auth/*` + Supabase
Sign-in is required from first launch. Three providers in priority order: Apple, Google, Email — Apple must be top per App Store policy when any social login is offered. `expo-apple-authentication` and `@react-native-google-signin/google-signin` are native modules, so auth changes ship in EAS builds, not OTA updates.

Session persists via `expo-secure-store`; auto-refresh is handled by `@supabase/supabase-js`. Sign-out clears the local session but keeps SQLite data on disk — re-signing in with the same account reattaches; signing in with a different account on the same device shows that user's (empty) view (data is filtered by `user_id`, not deleted).

Account deletion is in-app, multi-step (type DELETE to confirm), required by Apple's 5.1.1(v). Server-side delete marks `auth.users.deleted_at`; a Supabase scheduled function purges deleted users + their data after 30 days.

### Founders' tier — `grant_founder_if_eligible` RPC
First 100 signups get permanent founder status. Counter logic is in a Postgres SECURITY DEFINER function (`supabase/migrations/0001_init_auth_profiles.sql`) that locks the singleton `founder_counter` row with `FOR UPDATE` — two simultaneous signups serialize, no race condition. Founder slots are non-recoverable: deleted founder accounts do not free their slot. Granular by signup order, not download order.

The tier is forward-looking — it promises lifetime free access to a paid tier that doesn't ship until v1.1+. Working v1.1+ premium feature list lives in the celebration banner copy and in product notes.

## Compliance posture

This is a research/education tool, not medical advice. All disclaimer / terms copy is centralized in `lib/disclaimers.ts` (`DISCLAIMER_VERSION`, `TERMS_VERSION`, `DISCLAIMER_SHORT`, `DISCLAIMER_ONBOARDING`, `TERMS_FULL`, etc.). Don't inline disclaimer strings in screens. Don't introduce imperative dosing language ("take", "you should") — protocols are described as "research range" only. No vendor / purchase links.

The age-gate, terms acceptance, and safety acknowledgement timestamps are persisted on the `profile` row and gate access to the rest of the app via `RootGate`.

## Conventions specific to this repo

- TypeScript is strict — keep it that way. `npm run check:types` must pass.
- All routes are typed (`experiments.typedRoutes` is on in `app.json`).
- New Architecture is enabled (`newArchEnabled: true`). Avoid legacy bridge patterns.
- All user-data queries in `lib/db.ts` must filter by `user_id` (read via `requireUserId()`). Adding an un-scoped query is a data-leak bug — treat as a build break, not a warning.
- Secrets never live in code or `app.json`. Use `EXPO_PUBLIC_*` env vars for publishable keys (Supabase anon, Google iOS/Android client IDs); private keys (Apple .p8, Supabase service role) stay in the Supabase dashboard / EAS secrets and never reach the client.
- When adding peptides or editing `reconstitution` / `freq`, run `npm run check` and fix any reported drift before committing. Recent commits (`fix(freq): per-peptide audit`, `fix(catalog): defaultDoseMcg per peptide`) show the cadence — small, scoped fixes per peptide rather than blanket rewrites.
