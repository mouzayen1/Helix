// Calendar sync — write dose reminders into the device calendar store.
//
// Reaches BOTH Apple Calendar (iCloud) and Google Calendar, because we write
// to the OS calendar provider, which already syncs to whatever accounts the
// user added to their phone. No OAuth, no API keys, no backend.
//
// This mirrors lib/notifications.ts: same active-cycle → protocol → per-day
// dose expansion, same idempotent wipe-then-rewrite. The difference that
// matters: calendar writes propagate OUTWARD to the user's other devices, so
// this is NOT run on every foreground like scheduleAll(). It fires on cycle
// mutations (immediate, via syncCalendarSafe) and at most once a day on
// foreground (maybeSyncCalendar) so the rolling window stays fresh without
// churning the user's other devices.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type * as Calendar from 'expo-calendar';
import { getNotifPrefs, type NotifPrefs } from './notifications';
import { isItemScheduledOnDay } from './cycle-helpers';
import { getCurrentUserId, listActiveCycles, type CycleProtocolItem } from './db';

type CalendarModule = typeof Calendar;

// How far ahead we materialize events. Wider than notifications' 7-day window
// because a calendar comfortably holds a month; bounded so we don't write
// hundreds of events for an open-ended cycle.
const SYNC_WINDOW_DAYS = 30;

// Foreground refreshes are throttled to once a day — see maybeSyncCalendar.
const REFRESH_THROTTLE_MS = 24 * 60 * 60 * 1000;

// PRIVACY: calendar events are visible far outside the app — synced watches,
// laptops, shared family calendars. Keep titles generic. Do NOT put the
// peptide name or dose in the title/notes by default. (A future "detailed
// titles" pref could opt in, but the safe default is opaque.)
const EVENT_TITLE = 'Helix protocol';
const EVENT_NOTES = 'Open Helix to see today’s protocol.';
const EVENT_DURATION_MIN = 15;

const CALENDAR_TITLE = 'Helix';
const CALENDAR_COLOR = '#3B7A6F';

// State is keyed PER USER, mirroring the user_id isolation every db.ts query
// enforces. Without this, signing out of account A and into B on the same
// device would inherit A's enabled flag + calendar id — writing B's cycles
// into A's calendar, and letting B's "off" delete A's calendar. A device that
// somehow has no signed-in user gets an 'anon' bucket it never reuses.
const STORAGE_KEY_BASE = 'helix.calendarSync.v1';
const storageKey = () => `${STORAGE_KEY_BASE}.${getCurrentUserId() ?? 'anon'}`;

// IANA zone for event creation (Android requires it; iOS is happy with it).
const DEVICE_TZ = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
})();

// State lives in AsyncStorage, NOT the synced profile row, on purpose: a
// calendar id is device-specific (the same iCloud calendar has a different
// local id on each device), so it must never ride the Supabase sync layer.
type CalendarSyncState = {
  enabled: boolean;
  calendarId: string | null;
  lastSyncedAt: number | null;
};
const DEFAULT_STATE: CalendarSyncState = {
  enabled: false,
  calendarId: null,
  lastSyncedAt: null,
};

export async function getCalendarSyncState(): Promise<CalendarSyncState> {
  try {
    const raw = await AsyncStorage.getItem(storageKey());
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

async function setCalendarSyncState(patch: Partial<CalendarSyncState>) {
  const next = { ...(await getCalendarSyncState()), ...patch };
  await AsyncStorage.setItem(storageKey(), JSON.stringify(next));
  return next;
}

// ---- Availability guard (mirrors notifications.getNotificationsModule) ----
// Dynamically imported so expo-calendar never enters the web bundle (the
// `helix-app` Vercel build runs `expo export -p web`). Returns the module
// only when the calendar API is actually usable: never on web, never when the
// native module is missing (e.g. Expo Go without the config plugin), never on
// a device that reports no calendar support.

let calendarModule: Promise<CalendarModule | null> | null = null;

async function getCalendar(): Promise<CalendarModule | null> {
  if (Platform.OS === 'web') return null;
  calendarModule ??= import('expo-calendar').catch((err) => {
    if (__DEV__) console.warn('expo-calendar unavailable', err);
    return null;
  });
  const cal = await calendarModule;
  if (!cal) return null;
  return (await cal.isAvailableAsync().catch(() => false)) ? cal : null;
}

export async function ensureCalendarPermission(): Promise<boolean> {
  const cal = await getCalendar();
  if (!cal) return false;
  const cur = await cal.getCalendarPermissionsAsync();
  if (cur.status === 'granted') return true;
  if (!cur.canAskAgain) return false;
  const req = await cal.requestCalendarPermissionsAsync();
  return req.status === 'granted';
}

// ---- Helix-owned calendar -------------------------------------------------
// We create our OWN calendar rather than writing into the user's default, so
// the wipe-then-rewrite below can never touch their existing events. This is
// the calendar-world equivalent of the `owner: 'helix'` tag in notifications.

async function getDefaultSource(cal: CalendarModule): Promise<Calendar.Source> {
  if (Platform.OS === 'ios') {
    const def = await cal.getDefaultCalendarAsync();
    return def.source;
  }
  // Android: reuse a modifiable account's source, else fall back to local.
  const cals = await cal.getCalendarsAsync(cal.EntityTypes.EVENT);
  const writable = cals.find((c) => c.allowsModifications && c.source);
  return (
    writable?.source ?? { isLocalAccount: true, name: CALENDAR_TITLE, type: cal.SourceType.LOCAL }
  );
}

async function getOrCreateCalendar(cal: CalendarModule): Promise<string> {
  const { calendarId } = await getCalendarSyncState();
  if (calendarId) {
    // Verify it still exists — the user may have deleted it from the OS app.
    const cals = await cal.getCalendarsAsync(cal.EntityTypes.EVENT);
    if (cals.some((c) => c.id === calendarId)) return calendarId;
  }
  const source = await getDefaultSource(cal);
  const id = await cal.createCalendarAsync({
    title: CALENDAR_TITLE,
    color: CALENDAR_COLOR,
    entityType: cal.EntityTypes.EVENT,
    sourceId: Platform.OS === 'ios' ? source.id : undefined,
    source: Platform.OS === 'android' ? source : undefined,
    name: CALENDAR_TITLE,
    ownerAccount: Platform.OS === 'android' ? source.name : undefined,
    accessLevel: cal.CalendarAccessLevel.OWNER,
    isSynced: true,
    timeZone: DEVICE_TZ,
  });
  await setCalendarSyncState({ calendarId: id });
  return id;
}

// ---- Dose expansion (same walk as scheduleAll) ----------------------------

function parseHM(hm: string): { hour: number; minute: number } {
  const [h, m] = hm.split(':').map((n) => parseInt(n, 10));
  return { hour: isNaN(h) ? 8 : h, minute: isNaN(m) ? 0 : m };
}

function dayOfCycleOn(startsOn: string, date: Date): number {
  const s = new Date(startsOn);
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const b = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  return Math.floor((a.getTime() - b.getTime()) / 864e5);
}

/** Every dose datetime in the forward window across all active cycles.
 *  Paused cycles are excluded (status !== 'active') so they produce no
 *  events — matching how scheduleAll() and the Today screen treat them. */
async function expandDoseTimes(prefs: NotifPrefs): Promise<Date[]> {
  const cycles = (await listActiveCycles()).filter((c) => c.status === 'active');
  const out: Date[] = [];
  const today = new Date();
  for (const cycle of cycles) {
    let protocol: CycleProtocolItem[] = [];
    try {
      protocol = JSON.parse(cycle.protocol_json || '[]');
    } catch {
      protocol = [];
    }
    for (let offset = 0; offset < SYNC_WINDOW_DAYS; offset++) {
      const day = new Date(today);
      day.setDate(today.getDate() + offset);
      const doc = dayOfCycleOn(cycle.starts_on, day);
      for (const row of protocol) {
        if (!isItemScheduledOnDay(row, doc)) continue;
        const tKey = (
          row.time_of_day in prefs.times ? row.time_of_day : 'morning'
        ) as keyof NotifPrefs['times'];
        const { hour, minute } = parseHM(prefs.times[tKey]);
        const when = new Date(day);
        when.setHours(hour, minute, 0, 0);
        if (when.getTime() <= Date.now()) continue;
        out.push(when);
      }
    }
  }
  return out;
}

// ---- Sync -----------------------------------------------------------------
// Idempotent: delete every Helix event in the window, then rewrite from
// current cycle state. Scoped to OUR calendar, so it never touches the user's
// other events.

export async function syncCalendar(): Promise<void> {
  const state = await getCalendarSyncState();
  if (!state.enabled) return;
  const cal = await getCalendar();
  if (!cal) return;
  if (!(await ensureCalendarPermission())) return;

  const calendarId = await getOrCreateCalendar(cal);

  const windowStart = new Date();
  const windowEnd = new Date(Date.now() + SYNC_WINDOW_DAYS * 864e5);
  const existing = await cal.getEventsAsync([calendarId], windowStart, windowEnd);
  await Promise.all(existing.map((e) => cal.deleteEventAsync(e.id)));

  const prefs = await getNotifPrefs();
  const times = await expandDoseTimes(prefs);
  for (const when of times) {
    await cal.createEventAsync(calendarId, {
      title: EVENT_TITLE,
      notes: EVENT_NOTES,
      startDate: when,
      endDate: new Date(when.getTime() + EVENT_DURATION_MIN * 60_000),
      timeZone: DEVICE_TZ,
      alarms: [{ relativeOffset: 0 }], // alert at event time
    });
  }

  await setCalendarSyncState({ lastSyncedAt: Date.now() });
}

/** Foreground refresh: keeps the rolling window fresh but runs at most once a
 *  day, so returning to the app doesn't thrash events on the user's other
 *  synced devices. Cycle mutations bypass this and call syncCalendarSafe. */
export async function maybeSyncCalendar(): Promise<void> {
  const { enabled, lastSyncedAt } = await getCalendarSyncState();
  if (!enabled) return;
  if (lastSyncedAt && Date.now() - lastSyncedAt < REFRESH_THROTTLE_MS) return;
  await syncCalendarSafe();
}

export async function enableCalendarSync(): Promise<boolean> {
  if (!(await ensureCalendarPermission())) return false;
  await setCalendarSyncState({ enabled: true });
  await syncCalendar();
  return true;
}

export async function disableCalendarSync(): Promise<void> {
  const cal = await getCalendar();
  const { calendarId } = await getCalendarSyncState();
  if (cal && calendarId) {
    try {
      await cal.deleteCalendarAsync(calendarId);
    } catch {
      // Already gone (user deleted it in the OS app) — nothing to clean up.
    }
  }
  await setCalendarSyncState({ enabled: false, calendarId: null, lastSyncedAt: null });
}

// Safe wrapper so consumers can fire-and-forget, mirroring scheduleAllSafe.
export async function syncCalendarSafe(): Promise<void> {
  try {
    await syncCalendar();
  } catch (err) {
    if (__DEV__) console.warn('syncCalendar failed', err);
  }
}
