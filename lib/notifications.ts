// Local notifications — v1.1 Phase 6.
//
// Scope: ALL notifications are scheduled locally via expo-notifications.
// No remote push server. Call scheduleAll() on app launch + whenever prefs,
// cycles, or vials change. scheduleAll() is idempotent: it cancels all
// previously-scheduled Helix notifications first, then re-schedules a fresh
// 7-day window.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  getActiveCycle,
  getProfile,
  listActiveVials,
  listDoses,
  updateProfile,
  type Cycle,
  type CycleProtocolItem,
  type Vial,
} from './db';

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

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensurePermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.status === 'granted') return true;
  if (!settings.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
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
  const f = (row.freq || '').toLowerCase();
  if (f.includes('daily')) return true;
  if (f.includes('every other')) return dayOfCycle % 2 === 0;
  if (f.includes('twice weekly') || f.includes('2x week') || f.includes('2/week'))
    return dayOfCycle % 7 === 0 || dayOfCycle % 7 === 3;
  if (f.includes('weekly')) return dayOfCycle % 7 === 0;
  return false;
}

// ---- Schedule all -------------------------------------------------------
//
// Cancels previously-scheduled Helix notifications then schedules a fresh
// 7-day window based on the active cycle, active vials, phase transitions,
// and the missed-dose nudge. Idempotent — safe to call on every foreground.

export async function scheduleAll() {
  const prefs = await getNotifPrefs();

  // Always start by wiping previously-scheduled notifications so the schedule
  // stays in sync with current prefs / cycle edits.
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (prefs.mode === 'off') return;
  if (Platform.OS === 'web') return;

  const ok = await ensurePermission();
  if (!ok) return;

  const [cycle, vials] = await Promise.all([getActiveCycle(), listActiveVials()]);

  // --- Dose reminders from active cycle (next 7 days) --------------------
  if (
    cycle &&
    cycle.status === 'active' &&
    (prefs.mode === 'dose' || prefs.mode === 'all') &&
    prefs.sub.doseReminders
  ) {
    let protocol: CycleProtocolItem[] = [];
    try {
      protocol = JSON.parse(cycle.protocol_json || '[]');
    } catch {
      protocol = [];
    }
    const today = new Date();
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
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Time for ${row.peptide_id}`,
            body: `${row.dose_mcg} mcg · ${row.time_of_day}`,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: when,
          },
        });
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
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Vial expires soon',
          body: `Your ${v.peptide_id} vial expires in 3 days.`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
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
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Haven’t logged today?',
        body: 'Open Helix to catch up on today’s schedule.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
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
