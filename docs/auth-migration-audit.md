# Auth Migration Audit — `lib/db.ts` user_id Plumbing

**Purpose:** Inventory every SQL query in `lib/db.ts` that touches user-owned
data, so the auth feature's "scope every query by `user_id`" requirement
becomes a concrete operational checklist instead of a one-line hope.

**Status:** Audit complete; implementation pending Phase C of the auth feature.

---

## TL;DR

- **9 user-owned tables** need a nullable `user_id TEXT` column.
- **~57 SQL statements** in `lib/db.ts` need either an added `WHERE user_id = ?`
  filter (reads/updates/deletes) or an added `user_id` column in their `INSERT`.
- **1 special table** (`profile`) flips from a singleton-keyed-by-id-1 to a
  per-user row keyed by `user_id`. This is the largest architectural change in
  the audit.
- **2 read-only catalog tables** (`peptides`) — no `user_id` needed; these are
  global reference data.
- **All migrations use `addColumnIfMissing`** so existing installs upgrade
  in place. NULL `user_id` rows are pre-auth data; the Phase C attribution
  prompt backfills them.

---

## Table-by-table

### `profile` — special case (singleton → per-user)

Currently: one row, `id = 1`, holds the device's preferences (theme, units,
disclaimer acceptances, notif prefs, dismissed banners, dose unit pref).

After auth: one row per user, primary key flips from `id INTEGER` to
`user_id TEXT`. Singleton CHECK constraint dropped.

**Functions affected:**
- `getProfile()` — currently `WHERE id = 1`; becomes `WHERE user_id = ?` for
  the current session's user.
- `updateProfile(patch)` — same.
- `dismissBanner(key)` / `parseDismissedBanners()` — read/write to the same row.

**Migration challenges:**
- Existing local profile row has the device's preferences. Those need to
  transfer to the first user who signs in on this device. Handled by the
  Phase C attribution flow.
- Without the constraint, multiple users on the same device coexist (Phase
  C.2 "account switching").

### `saved_peptides` — bookmark list

Tracks which peptides the user has starred. PK = `peptide_id`, which means
two users on the same device can't have overlapping saves under the current
schema.

**Functions affected:**
- `isSaved(peptide_id)` — `WHERE peptide_id = ?` → `WHERE peptide_id = ? AND user_id = ?`
- `savePeptide(peptide_id)` — `INSERT` needs `user_id`
- `unsavePeptide(peptide_id)` — `DELETE WHERE peptide_id = ?` → `... AND user_id = ?`
- `listSavedPeptides()` — `SELECT ... ORDER BY saved_at DESC` → add `WHERE user_id = ?`

**Schema change:** PK becomes composite `(user_id, peptide_id)`.

### `vials` — user inventory

User's reconstituted vials. The most-queried table after `doses`.

**Functions affected (20 queries):**
- `createVial(input)` — `INSERT` + `UPDATE vials SET is_active = 0 WHERE peptide_id = ?`
  (the active-vial rotation) both need `user_id`.
- `getActiveVial(peptide_id)`, `listActiveVials()`, `getVial(id)`, `deactivateVial(id)`,
  `deleteVial(id)`, `restoreVial(id)`, `getVialHistory()`, `getVialsForPeptide()`,
  `matchingVialsForCycle()`, `getVialsForCycle(cycle_id)`, `attachVialToCycle()`,
  `detachVial()`, `updateVial()` — all add `WHERE user_id = ?`.
- The cascade in `deleteVial` (`UPDATE doses SET vial_id = NULL WHERE vial_id = ?`)
  doesn't need a user_id filter because `vials.user_id` is already enforced —
  but should add `AND user_id = ?` defensively in case of bug.

**Cross-references:** `doses.vial_id` references `vials.id`. Both must belong
to the same user — enforce at write time (a dose's `vial_id` must point to a
vial with matching `user_id`).

### `cycles` — user protocols

**Functions affected (9 queries):**
- `createCycle()`, `getActiveCycle()`, `listActiveCycles()`,
  `getActiveCycleForPeptide()`, `listCycles()`, `endCycle()`, `pauseCycle()`,
  `resumeCycle()`, `updateCycle()` — all need `user_id` filter.

**Cascade:** `endCycle` runs `UPDATE vials SET cycle_id = NULL WHERE cycle_id = ?`.
Same defensive filter as vials.

### `stacks` — user templates

**Functions affected (4 queries):** `createStack()`, `listStacks()`,
`getStack()`, `deleteStack()`.

### `doses` — user log

The most data-rich table. Each dose belongs to a user and (optionally) to a
vial + cycle.

**Functions affected (~15 queries):**
- `logDose()` — `INSERT` adds `user_id`; also the vial decrement
  `UPDATE vials SET remaining_mg = ... WHERE id = ?` needs defensive
  `AND user_id = ?`.
- `getDoseById()`, `updateDose()`, `listDoses()`, `getLastDoseForCyclePeptide()`,
  `deleteDose()`, `getDosesForVial()` — all need `user_id` filter.
- The `injection_sites_log` cascade (insert on log, delete on edit/delete) is
  consistent because `injection_sites_log.user_id` is derived from the parent
  dose. See below.

### `journal_entries` — user notes

**Functions affected (5 queries):** `upsertJournal()`, `getJournal()`,
`listJournal()`.

**Schema note:** `entry_date` is unique-per-user; with multi-user it becomes
unique on `(user_id, entry_date)`. Either composite PK or add a unique
constraint.

### `metrics` — user biomarker logs

**Functions affected (5 queries):** `insertMetric()`, `listMetrics()`,
`listAllMetricKindsWithLatest()`, `deleteMetric()`.

### `injection_sites_log` — rotation tracker

Logged when a dose is recorded with a site. Already filtered by route via
the JOIN with `doses` (we added that recently). With user_id, easier to
filter directly than via JOIN.

**Functions affected (6 queries):**
- The cascade inserts/deletes inside `logDose`, `updateDose`, `deleteDose`
  inherit user_id from the parent dose.
- `siteSuggestion()`, `siteRecency()`, `listDosesAtSite()` — currently
  filter to injection routes via JOIN; should add `WHERE doses.user_id = ?`
  to the same JOIN. (Or add `user_id` directly to this table and avoid the
  JOIN. Trade-off: storage vs query complexity. Recommend adding `user_id`
  directly — it's denormalized but every other table has it, consistency wins.)

### `dose_skips` — user skip records

**Functions affected (4 queries):** `createDoseSkip()`, `listDoseSkips()`,
`deleteDoseSkip()`.

### `peptides` — read-only catalog (no change)

Global reference data seeded on every install from `lib/peptides.ts`. No
`user_id`; identical across all users.

---

## Functions that need to learn about the current user

`lib/db.ts` is currently stateless — every function takes its inputs as
parameters. To add per-user scoping, the cleanest options are:

**Option A: Pass `user_id` as an explicit parameter to every function.**
- Pros: pure functions, no implicit context, easier to reason about.
- Cons: every call site needs updating. ~80 call sites across the app.

**Option B: A module-level "current user" set by the auth context on login/logout.**
- Pros: call sites don't change. The auth provider sets the user_id; every
  query reads from it.
- Cons: implicit state. Test isolation harder. Concurrency bugs possible if
  multiple users active on the same device (they aren't, but defensive
  coding still applies).

**Recommendation: Option B**, implemented as:
```ts
let currentUserId: string | null = null;
export function setCurrentUserId(id: string | null) { currentUserId = id; }
function requireUserId(): string {
  if (!currentUserId) throw new Error('No active user');
  return currentUserId;
}
```

Every `WHERE user_id = ?` and every `INSERT INTO ... (..., user_id) VALUES (..., ?)`
reads from `requireUserId()`. The auth session manager calls
`setCurrentUserId()` on sign-in and `setCurrentUserId(null)` on sign-out.

Throwing on no-user is the right default — it surfaces bugs immediately
rather than silently leaking data between users. Screens that need to
function pre-auth (sign-up screen, accept-terms screen) never call these
functions.

---

## Migration sequence (for Phase C of the auth feature)

1. **Add `user_id TEXT` column to every user-data table** via
   `addColumnIfMissing` (nullable, no default). Existing rows have NULL.
2. **Add `setCurrentUserId` / `requireUserId` helpers** to `lib/db.ts`.
3. **Modify every query** per the table-by-table list above. Strict mode:
   throw if no user is set when these functions are called.
4. **Run the Phase C attribution prompt** on first post-update launch: detect
   NULL `user_id` rows, prompt user "Keep your data?", on accept run
   `UPDATE <table> SET user_id = ? WHERE user_id IS NULL` for every table.
5. **Verify isolation** on test multi-user flow: sign in as User A, log
   data, sign out, sign in as User B, confirm User A's data is invisible.

---

## Supabase side (mirror schema, RLS-enforced)

Every user-data table on Supabase gets:
1. The same `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE`.
2. A Row Level Security policy:
   ```sql
   CREATE POLICY "Users access own rows" ON <table>
     USING (auth.uid() = user_id)
     WITH CHECK (auth.uid() = user_id);
   ```
3. RLS enabled: `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;`

The Supabase JS client automatically scopes queries to the current user;
client code never needs to add a `.eq('user_id', ...)` filter (it'd be
redundant). RLS is the backstop against a buggy client.

Sync between SQLite and Supabase is v1.1+ — out of scope for this audit.

---

## Dashboard checklist (NOT covered by migrations)

These settings live in the Supabase Dashboard, not in tracked SQL files.
Forgetting any of them surfaces as a runtime bug. After applying every
`supabase/migrations/*.sql`, verify each entry below.

1. **Authentication → URL Configuration → Redirect URLs** — must include
   `helix://reset-password` (password-reset email deep link target) and
   `helix://auth` (OAuth callback). Without these, the recovery link
   silently lands on the project's site URL and the app never opens.

2. **Authentication → Providers → Apple** — Service ID + Team ID + Key
   ID + .p8 contents filled in. The "Authorized client IDs" field
   accepts comma-separated values; include both the iOS bundle ID
   (`com.omniaworks.helix`) and the Apple Service ID.

3. **Authentication → Providers → Google** — Client IDs include the
   Web OAuth client ID (used by Supabase server-side), iOS Client ID,
   AND the Android Client ID. Comma-separated. Missing any one of these
   makes `signInWithIdToken` reject the token with "Invalid audience".

4. **Authentication → Identity Linking → "Manual linking enabled"** —
   **leave this ON.** When OFF, signing in with Google using an email
   that's already attached to an Apple account creates a separate
   `auth.users` row — the user ends up with two accounts sharing one
   email and can't see their original data after switching providers.
   With it ON, Supabase matches by email at sign-in and links the new
   identity to the existing user.

5. **Authentication → Email → "Confirm email"** — recommended OFF for
   v1.0 (signup friction); a confirmed email isn't a meaningful safety
   improvement over the provider-issued identity verification. If you
   flip it ON later, `signUpWithEmail` returns `requiresEmailVerification: true`
   and the UI handles it (`app/(auth)/email-sign-up.tsx`).
