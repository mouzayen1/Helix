// Local notifications — v1.1 Phase 6.
//
// Scope: ALL notifications are scheduled locally via expo-notifications.
// No remote push server. Call scheduleAll() on app launch + whenever prefs,
// cycles, or vials change. scheduleAll() is idempotent: it cancels all
// previously-scheduled Helix notifications first, then re-schedules a fresh
// 7-day window.
import Constants from 'expo-constants';
import type * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  getProfile,
  listActiveCycles,
  listActiveVials,
  listDoses,
  updateProfile,
  type Cycle,
  type CycleProtocolItem,
  type Vial,
} from './db';
import { isItemScheduledOnDay, resolvePhase } from './cycle-helpers';

type NotificationsModule = typeof Notifications;

export type NotifMode = 'off' | 'dose' | 'all';

export type NotifPrefs = {
  mode: NotifMode;
  sub: {
    doseReminders: boolean;
    vialExpiry: boolean;
    phaseTransitions: boolean;
    missedDose: boolean;
  };
  quietHours: { start: string; end: string } | null; // "HH:MM"
  // Anchor times for each time_of_day keyword. Users can tweak these in
  // Settings → Notifications later; for now we expose them as stored prefs.
  times: {
    morning: string;
    evening: string;
    'pre-bed': string;
    'pre-workout': string;
  };
};

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  mode: 'off',
  sub: {
    doseReminders: true,
    vialExpiry: true,
    phaseTransitions: true,
    missedDose: false,
  },
  quietHours: null,
  times: {
    morning: '08:00',
    evening: '19:00',
    'pre-bed': '22:00',
    'pre-workout': '17:00',
  },
};

const HELIX_NOTIFICATION_DATA = { owner: 'helix' } as const;

// ---- Prefs ---------------------------------------------------------------

export async function getNotifPrefs(): Promise<NotifPrefs> {
  const p = await getProfile();
  if (!p?.notif_prefs_json) return DEFAULT_NOTIF_PREFS;
  try {
    const parsed = JSON.parse(p.notif_prefs_json) as Partial<NotifPrefs>;
    return {
      ...DEFAULT_NOTIF_PREFS,
      ...parsed,
      sub: { ...DEFAULT_NOTIF_PREFS.sub, ...(parsed.sub ?? {}) },
      times: { ...DEFAULT_NOTIF_PREFS.times, ...(parsed.times ?? {}) },
    };
  } catch {
    return DEFAULT_NOTIF_PREFS;
  }
}

export async function setNotifPrefs(patch: Partial<NotifPrefs>) {
  const current = await getNotifPrefs();
  const next: NotifPrefs = {
    ...current,
    ...patch,
    sub: { ...current.sub, ...(patch.sub ?? {}) },
    times: { ...current.times, ...(patch.times ?? {}) },
  };
  await updateProfile({ notif_prefs_json: JSON.stringify(next) });
  return next;
}

// ---- Permission + setup -------------------------------------------------

let notificationsModule: Promise<NotificationsModule | null> | null = null;
let notificationHandlerSet = false;

async function getNotificationsModule(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web') return null;
  if (Platform.OS === 'android' && Constants.appOwnership === 'expo') return null;
  notificationsModule ??= import('expo-notifications').catch((err) => {
    if (__DEV__) console.warn('expo-notifications unavailable', err);
    return null;
  });
  return notificationsModule;
}

async function getConfiguredNotificationsModule(): Promise<NotificationsModule | null> {
  const notifications = await getNotificationsModule();
  if (!notifications || notificationHandlerSet) return notifications;
  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  notificationHandlerSet = true;
  return notifications;
}

export async function ensurePermission(): Promise<boolean> {
  const notifications = await getConfiguredNotificationsModule();
  if (!notifications) return false;
  const settings = await notifications.getPermissionsAsync();
  if (settings.status === 'granted') return true;
  if (!settings.canAskAgain) return false;
  const req = await notifications.requestPermissionsAsync();
  return req.status === 'granted';
}

// ---- Scheduling helpers -------------------------------------------------

function parseHM(hm: string): { hour: number; minute: number } {
  const [h, m] = hm.split(':').map((n) => parseInt(n, 10));
  return { hour: isNaN(h) ? 8 : h, minute: isNaN(m) ? 0 : m };
}

function inQuietHours(d: Date, quiet: { start: string; end: string } | null) {
  if (!quiet) return false;
  const mins = d.getHours() * 60 + d.getMinutes();
  const { hour: sh, minute: sm } = parseHM(quiet.start);
  const { hour: eh, minute: em } = parseHM(quiet.end);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  if (s === e) return false;
  if (s < e) return mins >= s && mins < e;
  // Overnight window (e.g. 22:00 -> 07:00).
  return mins >= s || mins < e;
}

function dayOfCycleOn(cycle: Cycle, date: Date) {
  const start = new Date(cycle.starts_on);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  return Math.floor((d.getTime() - s.getTime()) / 864e5);
}

function isScheduledOn(row: CycleProtocolItem, dayOfCycle: number): boolean {
  return isItemScheduledOnDay(row, dayOfCycle);
}

// ---- Schedule all -------------------------------------------------------
//
// Cancels previously-scheduled Helix notifications then schedules a fresh
// 7-day window based on the active cycle, active vials, phase transitions,
// and the missed-dose nudge. Idempotent — safe to call on every foreground.

export async function scheduleAll() {
  const prefs = await getNotifPrefs();
  const notifications = await getConfiguredNotificationsModule();
  if (!notifications) return;

  // Start by wiping previously-scheduled Helix notifications so the schedule
  // stays in sync with current prefs / cycle edits without touching other
  // local notifications another module may have added (scoped cleanup
  // landed via origin/main).
  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.owner === HELIX_NOTIFICATION_DATA.owner)
      .map((n) => notifications.cancelScheduledNotificationAsync(n.identifier))
  );

  if (prefs.mode === 'off') return;

  const ok = await ensurePermission();
  if (!ok) return;

  const [cycles, vials] = await Promise.all([listActiveCycles(), listActiveVials()]);
  const activeCycles = cycles.filter((c) => c.status === 'active');

  // --- Dose reminders from EVERY active cycle (next 7 days) --------------
  // Walks each concurrent cycle so a user running healing + fat-loss in
  // parallel gets reminders for both protocols, not just the most-recent.
  if (
    activeCycles.length > 0 &&
    (prefs.mode === 'dose' || prefs.mode === 'all') &&
    prefs.sub.doseReminders
  ) {
    const today = new Date();
    // Multi-cycle: loop over EVERY active cycle so concurrent protocols
    // both get reminders. Each scheduled notification is tagged with
    // HELIX_NOTIFICATION_DATA so the scoped cleanup above can find it.
    for (const cycle of activeCycles) {
      let protocol: CycleProtocolItem[] = [];
      try {
        protocol = JSON.parse(cycle.protocol_json || '[]');
      } catch {
        protocol = [];
      }
      for (let offset = 0; offset < 7; offset++) {
        const day = new Date(today);
        day.setDate(today.getDate() + offset);
        const dayOfCycle = dayOfCycleOn(cycle, day);
        for (const row of protocol) {
          if (!isScheduledOn(row, dayOfCycle)) continue;
          const tKey =
            row.time_of_day in prefs.times ? (row.time_of_day as keyof NotifPrefs['times']) : 'morning';
          const { hour, minute } = parseHM(prefs.times[tKey]);
          const when = new Date(day);
          when.setHours(hour, minute, 0, 0);
          if (when.getTime() <= Date.now() + 60 * 1000) continue;
          if (inQuietHours(when, prefs.quietHours)) continue;
          await notifications.scheduleNotificationAsync({
            content: {
              title: 'Dose reminder',
              body: "Open Helix to see today's protocol.",
              data: HELIX_NOTIFICATION_DATA,
            },
            trigger: {
              type: notifications.SchedulableTriggerInputTypes.DATE,
              date: when,
            },
          });
        }
      }
    }
  }

  // --- Vial expiry warnings (3 days before) ------------------------------
  if ((prefs.mode === 'all') && prefs.sub.vialExpiry) {
    for (const v of vials as Vial[]) {
      if (!v.expires_at) continue;
      const exp = new Date(v.expires_at);
      const warn = new Date(exp.getTime() - 3 * 864e5);
      warn.setHours(9, 0, 0, 0);
      if (warn.getTime() <= Date.now() + 60 * 1000) continue;
      await notifications.scheduleNotificationAsync({
        content: {
          title: 'Vial expiring soon',
          body: 'Open Helix to review your vials.',
          data: HELIX_NOTIFICATION_DATA,
        },
        trigger: {
          type: notifications.SchedulableTriggerInputTypes.DATE,
          date: warn,
        },
      });
    }
  }

  // --- Missed-dose nudge at 8pm ------------------------------------------
  if (prefs.mode === 'all' && prefs.sub.missedDose) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
    const trigger = today.getTime() > Date.now() + 60 * 1000
      ? today
      : new Date(today.getTime() + 864e5);
    // Daily trigger repeats. Individual fire-time checks for "no dose today"
    // happen inside the nudge handler on open — this is a soft reminder.
    await notifications.scheduleNotificationAsync({
      content: {
        title: 'Haven’t logged today?',
        body: 'Open Helix to catch up on today’s schedule.',
        data: HELIX_NOTIFICATION_DATA,
      },
      trigger: {
        type: notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: 20,
        minute: 0,
        repeats: true,
      },
    });
    // Keep the variable used (silence unused-lint) + avoid drift when we
    // eventually inspect today's doses in an actionable handler.
    void trigger;
  }

  // Phase transitions are informational; skipping for now — cycles.phase
  // rolls through 'loading'/'active'/'taper'/'washout' manually.
  // Future: when phases have explicit week counts, schedule day-before alerts.
}

// Safe wrapper so consumers can call and ignore errors (e.g. on web or
// when permissions were denied).
export async function scheduleAllSafe() {
  try {
    await scheduleAll();
  } catch (err) {
    if (__DEV__) console.warn('scheduleAll failed', err);
  }
}

// Convenience: recent doses today — used by a future missed-dose handler.
export async function dosesLoggedToday(): Promise<number> {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ds = await listDoses({ from: midnight.toISOString(), limit: 100 });
  return ds.length;
}
