# Helix

A research-forward peptide education and tracking app. This is the
working Android demo build following the Helix Build Specification
v2.0 — Phase 1 local-only (no backend, no accounts).

## What's in this build

**Fully interactive, no mock data.** A fresh user runs the onboarding,
enters their own data, and uses the app end-to-end.

### Screens
- **Welcome** — pre-auth splash.
- **Onboarding** — age gate, safety acknowledgement, unit / theme
  preferences, choose-path.
- **Today** — greeting, active cycle bar, today's logged doses,
  active vials strip, quick actions, footer disclaimer.
- **Library** — full 42-peptide catalog with live search, class chips,
  saved section.
- **Peptide Detail** — sequence, quick facts, suggested reconstitution,
  research-use banner, Overview / Dosing / Research / Notes tabs, full
  mechanism, peer-reviewed citations with PubMed links, save/un-save.
- **Stacks** — active cycle card, curated templates (Healing / GH-opt /
  Fat-loss), saved stacks, past cycles.
- **Cycle Planner** — name, duration, phase, per-peptide protocol rows
  (dose / freq / time-of-day). Generates the active cycle.
- **Cycle Detail** — progress bar, protocol list, end-cycle action.
- **Stack Builder** — named stack with goal, synergy score heuristic,
  peptide rows.
- **Progress** — metric tiles (weight / HR / sleep / IGF-1 / glucose
  / BP / waist / body fat), journal preview, insight placeholder.
- **Metric Time-Series** — SVG line chart, min/avg/max/delta stats,
  per-reading history with delete.
- **Journal Entry** — mood 1–5, energy / sleep-quality / libido /
  recovery 0–10 sliders, sleep hours stepper, tag multi-select, notes.
  Upserts by date.
- **Log Dose (modal)** — peptide picker, dose stepper, auto-computed
  volume-in-units from active vial, suggested injection site, route
  chips, time, note. Writes to SQLite, decrements vial remaining_mg,
  appends site log.
- **Reconstitute (modal)** — strength presets, BAC water + target dose
  steppers, live concentration / units-per-dose / total-doses, visual
  syringe. Saves a vial row.
- **Log Metric (modal)** — kind picker, value input, note.
- **Injection Sites (modal)** — anatomical SVG body map with 8-zone
  rotation coloring (green / amber / red by recency), accent-pulse
  suggestion, full zone list.
- **Settings** — appearance (theme / accent), units (lb/kg, units/mL),
  privacy (notifications, biometric lock), data (export JSON / CSV,
  delete all).
- **Export** — CSV + JSON export via expo-sharing.
- **Delete all data** — type-to-confirm destructive flow.

### Peptide catalog (42 monographs)
BPC-157, TB-500, Thymosin β4, GHK-Cu, Pentadeca Arginate, KPV, Thymosin
α-1, LL-37, Ipamorelin, CJC-1295 (no DAC), CJC-1295 DAC, Sermorelin,
Tesamorelin, Hexarelin, GHRP-2, GHRP-6, MK-677, Semaglutide,
Tirzepatide, Retatrutide, Liraglutide, Cagrilintide, AOD-9604,
5-Amino-1MQ, MOTS-c, Selank, Semax, Cerebrolysin, Dihexa, Epitalon,
SS-31 (Elamipretide), NAD+, FOXO4-DRI, Humanin, PT-141, Melanotan II,
Kisspeptin-10, Oxytocin, DSIP, IGF-1 LR3, IGF-1 DES, PEG-MGF.

Each entry has: sequence, formula, MW, half-life, route, research
dose range, frequency, suggested reconstitution, research summary,
numbered mechanism paragraphs, common stack partners, notes, and
peer-reviewed citations with PubMed/PMC links.

## Stack

- Expo SDK 54 + React Native 0.81 + TypeScript (strict)
- expo-router (file-based navigation)
- expo-sqlite (local persistence)
- expo-notifications (local dose reminders, opt-in)
- expo-file-system + expo-sharing (export)
- react-native-svg (body map, metric charts, icons)
- Inter + IBM Plex Mono (via @expo-google-fonts)

## Data model (local SQLite)

`profile` · `peptides` · `saved_peptides` · `vials` · `doses` ·
`cycles` · `stacks` · `journal_entries` · `metrics` ·
`injection_sites_log`. Mirrors the Supabase schema in spec §05 for
lossless migration when cloud sync ships in Phase 2.

## Compliance

Centralised disclaimer copy in `lib/disclaimers.ts`. Age gate,
safety acknowledgement, research-only framing, no imperative dosing
language, no vendor links.

## Running on Android

```bash
# Install
npm install

# Dev via Expo Go
npx expo login
npx expo start
# scan QR with Expo Go on Android

# Or produce an installable APK via EAS
eas build --platform android --profile preview
```

## v1.1 — Flexibility & vial tracking

v1.1 layers user-flexibility and lifecycle features on top of the v1.0
Android demo. All additions are local-only and delivered via OTA.

- **Vial library** (`/vials`) — active and depleted vials grouped by
  peptide, remaining bar, expiry badge, dose count, cost per vial.
- **Vial detail** (`/vials/:id`) — edit strength / BAC water / expiry /
  cost / notes with dose-history-preserving recompute, per-vial dose
  timeline, mark depleted, restore, delete.
- **Multi-vial per peptide** — when more than one active vial exists
  for a peptide, Log Dose shows an inline picker so the user chooses
  which vial the dose came from. Defaults to closest-to-expiry.
- **Backdated doses + notes** — Log Dose lets you pick any datetime
  in the last 30 days and add a free-form note (side-effects, mood).
- **Duplicate-dose soft warning** — saving a dose within 10 minutes
  of an existing one prompts "Already logged recently?"
- **Skip with reason** — Today schedule has a Skip button that opens
  a sheet with preset chips (Forgot, Traveling, Side effect, Running
  low, Rest day, Other) + optional note. Skipped rows render muted
  with a SKIPPED badge; tap to un-skip.
- **Pause / resume cycle** — Cycle Detail has Pause / Resume buttons;
  Today shows a paused-cycle banner with a Resume action. Resume
  shifts the end-date forward by the days paused.
- **Library search** — debounced search across name, subtitle, class,
  summary, and stack partners; clear button; ★ Saved-only filter chip.
- **Copy cycle** — completed or cancelled cycles get a "Copy to new
  cycle" button that pre-fills the New Cycle flow at step 3.
- **Per-cycle journal** — cycle detail lists journal entries whose
  date falls inside the cycle window.
- **Local notifications** (opt-in) — Settings → Notifications gives
  you Off / Dose-only / All-alerts, plus sub-toggles for dose
  reminders, vial expiry (3 days ahead), phase transitions, and an
  8pm missed-dose nudge. Preferred times + quiet hours configurable.
  All scheduling is local — no remote push.
- **Export as JSON / CSV** — Settings → Export uses `exportAllData()`
  with `schema_version` + `exported_at`, record counts in the
  confirmation, and per-table sections for CSV.
- **Cost rollup** — Progress tab shows total spent, cost per dose,
  and cost of the current cycle when any vial has `cost_usd` set.
  Hidden entirely otherwise.
- **Haptics** — light success pulses on Log Dose save, Resume, and
  Restore; warn pulses on Skip and Mark Depleted; error on failed
  save.
- **Accessibility** — a11y labels/roles on all new buttons and
  toggles, loading states on vial screens, discard-changes prompts
  on dirty edits.

## What's next

Still on the roadmap for launch (spec §04 phases 2–3):

- **Phase 2** — Supabase auth, cloud sync with outbox + conflict
  resolution, push notifications, biometric lock, migration from
  local to cloud.
- **Phase 3** — 7-chapter Learn path, subscription paywall via
  RevenueCat, landing page with privacy policy and ToS on a real
  domain, App Store / Play Store submission packages.

See `docs/helix_build_spec_v2.pdf` for the full specification.
