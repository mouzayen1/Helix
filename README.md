# Helix

Peptide research & tracking app — Android demo build. Phase 1 of
the [Helix Build Specification](docs/helix-spec.md) (local-only
SQLite, no backend, no accounts).

## Stack

- Expo SDK 54 + React Native 0.81
- TypeScript
- expo-router (file-based nav)
- expo-sqlite (local storage)
- react-native-svg (icons, charts, body map)
- Zustand (state)
- Inter + IBM Plex Mono (via `@expo-google-fonts/*`)

## Screens in this build

- `(tabs)/index.tsx` — Today (greeting, protocol, cycle bar, quick actions, insight)
- `(tabs)/library.tsx` — Peptide encyclopedia with category filter
- `(tabs)/progress.tsx` — Placeholder (Phase 2)
- `(tabs)/me.tsx` — Placeholder (Phase 2)
- `peptide/[id].tsx` — Peptide detail
- `log-dose.tsx` — Modal dose logger (writes to SQLite)
- `reconstitute.tsx` — Reconstitution calculator

## Running

```bash
# Install
npm install

# Dev via Expo Go (scan QR)
npx expo start

# Production APK via EAS
eas build --platform android --profile preview
```

## Data model

See `lib/db.ts`. Three tables for Phase 1:
`peptides` (seeded with 6 from `lib/peptides.ts`), `vials`, `doses`.

## Next phases

See spec §04. Phase 2 adds Supabase/Firebase auth + cloud sync,
injection-site map, cycle planner, journal, stack builder. Phase 3
expands the peptide catalog to 40+ with citations and ships to
stores.
