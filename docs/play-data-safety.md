# Google Play — Data Safety form answers

Fill-in guide for the Play Console **Data safety** section. Every
answer below is verified against the shipping build (commit on
`claude/visual-overhaul-v1`), not assumed. Where Google's definitions
matter, the rationale is spelled out so the answer is defensible if
reviewed.

> **Google's definition of "collected":** data is *collected* only if
> it is **transmitted off the device**. Data processed only on-device
> is **not** "collected" or "shared." This single rule is why most of
> our answers are *No* — see Health & fitness below.

Cross-reference: `/privacy` (published Privacy Policy), `lib/db.ts`
(local SQLite), `lib/auth/*` (the only code that writes to Supabase),
`lib/notifications.ts` (local-only notifications), `package.json` (no
analytics/crash SDKs).

---

## Section 1 — Data collection & security

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all user data collected by your app encrypted in transit? | **Yes** (HTTPS/TLS to Supabase; `@supabase/supabase-js`) |
| Do you provide a way for users to request that their data is deleted? | **Yes** — in-app Settings → Delete Account, plus a 30-day backend purge (migration `0005`) |

For the deletion question, select **"Users can request that data be
deleted"** and provide:
- Deletion method: in-app (Settings → Delete Account, type DELETE to confirm).
- Deletion URL (if asked): `https://gethelixapp.org/privacy` (deletion is described in §8) or the support email `support@gethelixapp.org`.

---

## Section 2 — Data types

### ✅ Data we DO collect (transmitted to Supabase for auth)

| Data type (Google category → field) | Collected | Shared | Ephemeral? | Required? | Purposes |
|---|---|---|---|---|---|
| Personal info → **Email address** | Yes | **No** | No | **Required** | Account management, App functionality |
| Personal info → **Name** | Yes | **No** | No | **Optional** (only if Apple/Google supplies it) | Account management, App functionality |
| Personal info → **User IDs** (account UUID) | Yes | **No** | No | **Required** | Account management, App functionality |

For all three: purposes are **App functionality** and **Account
management** only. Do **not** tick Analytics, Advertising/marketing,
Fraud prevention, Personalization, or Developer communications.

### ❌ Data we do NOT collect — answer *No* to every one

| Google category | Answer | Why |
|---|---|---|
| **Health and fitness** (health info, fitness info) | **No** | Doses, vials, cycles, metrics (weight/sleep/labs), journal entries live **only** in local SQLite (`lib/db.ts`). No code path writes them to Supabase — the only `.from(...)` writes are to `profiles`/`founder_counter`. Never transmitted off device ⇒ not "collected." |
| Location (approximate / precise) | No | No location APIs used |
| Financial info | No | No payments in v1.0 |
| Messages | No | — |
| Photos and videos | No | — |
| Audio files | No | — |
| Files and docs | No | — |
| Calendar | No | — |
| Contacts | No | — |
| App activity (interactions, search history, installed apps, other UGC, other actions) | No | No analytics/event tracking of any kind |
| Web browsing history | No | — |
| App info and performance → **Crash logs** | No | No Crashlytics/Sentry/Bugsnag in deps |
| App info and performance → **Diagnostics / other** | No | No performance SDKs |
| **Device or other IDs** | No | No advertising ID, no device ID, no push token collected (notifications are local — `lib/notifications.ts`) |

---

## Section 3 — Resulting public "Data safety" label

After submitting the above, your store label reads, in effect:

- **Data shared with third parties:** None.
- **Data collected:** Email address, Name, User IDs — for account
  management and app functionality.
- **Data is encrypted in transit:** Yes.
- **You can request that data be deleted:** Yes.
- **No data collected:** for all health, activity, location, and
  device-identifier categories.

---

## Defensibility notes (keep for your records)

1. **Health data is on-device only.** Verified: the Supabase write
   surface is limited to `lib/auth/*` and `app/(auth)/accept-terms.tsx`,
   touching only `profiles` (`display_name`, `terms_accepted_at`,
   `terms_version`, `founder_*`) and `founder_counter`. There is **no**
   `supabase.from('doses' | 'vials' | 'cycles' | 'metrics' |
   'journal_entries' | …)` write anywhere. The server tables exist
   (migration `0002`) but are unused until v1.1 sync — when sync ships,
   this form must be revisited (health data would then become
   "collected").
2. **No analytics / crash / ad SDKs.** `package.json` contains none
   (no Firebase, Sentry, Crashlytics, Bugsnag, PostHog, Segment,
   Amplitude, Mixpanel).
3. **No push tokens.** `lib/notifications.ts` schedules locally via
   `expo-notifications`; it never calls `getExpoPushToken` /
   `getDevicePushToken`.
4. **Deletion is real, not cosmetic.** `delete_my_account()` soft-deletes
   immediately and scrubs identity columns; `purge_deleted_accounts()`
   (migration `0005`, scheduled daily 03:00 UTC via pg_cron) hard-deletes
   `auth.users` after 30 days, cascading every `public.*` table.

> ⚠️ **When v1.1 cloud sync ships:** health/research data will begin
> transmitting off-device. At that point update this form (Health and
> fitness → Collected = Yes) **and** the Privacy Policy §2/§3 before
> releasing the synced build.
