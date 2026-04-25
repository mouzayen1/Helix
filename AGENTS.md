# Repository Guidelines

## Project Structure & Module Organization

Helix is an Expo SDK 54 React Native app using `expo-router` and strict TypeScript. App routes live in `app/`: tab routes are under `app/(tabs)`, onboarding is under `app/(onboarding)`, modals such as `log-dose.tsx` sit at the route root, and dynamic screens use folders like `peptide/[id].tsx`. Shared UI lives in `components/`, theme context and tokens in `theme/`, and core logic in `lib/`. The SQLite data layer is `lib/db.ts`; peptide catalog data is in `lib/peptides.ts` plus `lib/peptide-extras/`. Static images are in `assets/images/`. Verification scripts live in `scripts/`.

## Build, Test, and Development Commands

- `npm install` installs dependencies from `package-lock.json`.
- `npm run start` starts Expo locally.
- `npm run android`, `npm run ios`, and `npm run web` start the matching Expo target.
- `npm run lint` runs Expo ESLint.
- `npm run check:types` runs `tsc --noEmit`.
- `npm run check:catalog` verifies catalog reconstitution math.
- `npm run check:freq` verifies frequency coverage.
- `npm run check` is the required quality gate before pushing.
- `eas build --platform android --profile preview` builds the internal Android APK.

## Coding Style & Naming Conventions

Use TypeScript and React function components. Keep strict mode passing and use the `@/*` path alias for repo-root imports. Follow existing route filenames for navigation (`cycle/new.tsx`, `metric/[kind].tsx`). Prefer shared primitives from `components/Primitives.tsx` and colors, spacing, radii, and fonts from `theme/tokens.ts`; avoid hardcoded screen-level palette values. Keep SQLite schema changes idempotent: add `CREATE TABLE IF NOT EXISTS` and `addColumnIfMissing` migrations in `lib/db.ts`.

## Testing Guidelines

There is no general unit test suite. The regression net is TypeScript, linting, catalog math, and frequency verification. Run `npm run check` for any code change, and especially after editing `lib/peptides.ts`, `lib/peptide-extras/`, `lib/freq.ts`, or catalog reconstitution/frequency strings. If `lib/freq.ts` changes, mirror the parser behavior in `scripts/check-freq-coverage.mjs`.

## Commit & Pull Request Guidelines

Recent commits use scoped Conventional Commit style, for example `fix(freq): ...`, `feat(catalog): ...`, `polish(a11y): ...`, and `chore: ...`. Keep commits small and scoped. Pull requests should include a clear summary, affected routes or modules, verification commands run, and screenshots or screen recordings for UI changes.

## Compliance & Configuration Notes

This is a local-only Phase 1 demo: do not add auth, backend clients, vendor links, or new network data flows. Keep disclaimer and terms copy centralized in `lib/disclaimers.ts`. Avoid imperative medical language; describe protocols as research ranges only.
