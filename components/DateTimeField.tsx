// Reusable date/time picker — extracted from log-dose so Log Metric and
// Journal Entry can share the same backdating UX. Three quick chips
// (Now · Yesterday · 2 days ago) cover the 95% case; day + time steppers
// underneath let users dial to any timestamp inside [minDaysBack ago, now].
//
// Props:
//   value          — the current Date.
//   onChange       — called with a new Date whenever the user edits.
//   label          — section label shown in the collapsed pill.
//   mode           — 'datetime' (default) shows hour/min steppers.
//                    'date' hides them so journal entries pick a calendar
//                    day without needing to commit to a time.
//   minDaysBack    — how far back the user can go. Default 30.
//   allowFuture    — when false (default) the day stepper caps at today.
//
// Caveat: this component owns NO state of its own. Parents track `value`
// in their own setState and re-render. Keeps the call sites trivially
// testable and avoids the "two-way binding lost in stale closure" trap.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { IconClock } from './Icons';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, space } from '../theme/tokens';

type Props = {
  value: Date;
  onChange: (next: Date) => void;
  label?: string;
  mode?: 'datetime' | 'date';
  minDaysBack?: number;
  allowFuture?: boolean;
};

export function DateTimeField({
  value,
  onChange,
  label = 'When',
  mode = 'datetime',
  minDaysBack = 30,
  allowFuture = false,
}: Props) {
  const { t } = useTheme();
  const [editing, setEditing] = useState(false);
  const showTime = mode === 'datetime';

  // Quick chips: the only three users actually reach for. Hour-offset
  // chips (-1h / -3h / -6h) lived here previously and were removed —
  // anyone who needs precise hour control uses the steppers below.
  const QUICK_CHIPS: { label: string; build: () => Date }[] = [
    { label: 'Now', build: () => new Date() },
    {
      label: 'Yesterday',
      build: () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d;
      },
    },
    {
      label: '2 days ago',
      build: () => {
        const d = new Date();
        d.setDate(d.getDate() - 2);
        return d;
      },
    },
  ];

  const stepDay = (delta: number) => {
    const d = new Date(value);
    d.setDate(d.getDate() + delta);
    const earliest = new Date();
    earliest.setDate(earliest.getDate() - minDaysBack);
    earliest.setHours(0, 0, 0, 0);
    if (d.getTime() < earliest.getTime()) return;
    if (!allowFuture && d.getTime() > Date.now()) return;
    onChange(d);
  };

  const stepHour = (delta: number) => {
    const d = new Date(value);
    d.setHours((d.getHours() + delta + 24) % 24);
    onChange(d);
  };

  const stepMinute = (delta: number) => {
    const d = new Date(value);
    d.setMinutes((d.getMinutes() + delta + 60) % 60);
    onChange(d);
  };

  return (
    <View>
      {/* Collapsed summary row — taps to expand the editor */}
      <Pressable
        onPress={() => setEditing((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatPretty(value, showTime)}. Tap to edit.`}
        style={{
          backgroundColor: t.surface,
          borderRadius: radius.md,
          padding: space.md,
          borderWidth: 1,
          borderColor: editing ? t.accent : t.line,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <IconClock size={16} color={t.ink3} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 10,
              color: t.ink3,
              fontFamily: font.sansSemi,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}
          >
            {label}
          </Text>
          <Text style={{ fontSize: 14, color: t.ink, fontFamily: font.sansSemi, marginTop: 2 }}>
            {formatPretty(value, showTime)}
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: t.accent, fontFamily: font.sansSemi }}>
          {editing ? 'Done' : 'Edit'}
        </Text>
      </Pressable>

      {editing ? (
        <View
          style={{
            marginTop: 6,
            padding: space.md,
            backgroundColor: t.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: t.line,
            gap: space.md,
          }}
        >
          <View style={{ gap: 6 }}>
            <Text style={labelStyle(t)}>Quick</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {QUICK_CHIPS.map((chip) => (
                <Pressable
                  key={chip.label}
                  onPress={() => onChange(chip.build())}
                  accessibilityRole="button"
                  accessibilityLabel={`Set to ${chip.label}`}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: t.line,
                    backgroundColor: t.surfaceAlt,
                  }}
                >
                  <Text style={{ fontSize: 12, color: t.ink, fontFamily: font.sansMed }}>
                    {chip.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={labelStyle(t)}>Day</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Stepper onPress={() => stepDay(-1)} a11y="Previous day">−</Stepper>
              <View style={pillReadout(t)}>
                <Text style={{ fontSize: 13, color: t.ink, fontFamily: font.sansSemi }}>
                  {value.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
              <Stepper onPress={() => stepDay(1)} a11y="Next day">+</Stepper>
            </View>
          </View>

          {showTime ? (
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={labelStyle(t)}>Hour</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <SmallStepper onPress={() => stepHour(-1)} a11y="Previous hour">
                    −
                  </SmallStepper>
                  <Text style={readoutStyle(t)}>
                    {value.getHours().toString().padStart(2, '0')}
                  </Text>
                  <SmallStepper onPress={() => stepHour(1)} a11y="Next hour">
                    +
                  </SmallStepper>
                </View>
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={labelStyle(t)}>Min</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <SmallStepper onPress={() => stepMinute(-5)} a11y="Subtract five minutes">
                    −5
                  </SmallStepper>
                  <Text style={readoutStyle(t)}>
                    {value.getMinutes().toString().padStart(2, '0')}
                  </Text>
                  <SmallStepper onPress={() => stepMinute(5)} a11y="Add five minutes">
                    +5
                  </SmallStepper>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// Returns "Today, 3:42 PM" / "Yesterday, 8:00 AM" / "Sat, Apr 19" depending
// on the offset and whether time is being shown. Used inside the field's
// collapsed pill and re-exported for callers who want to render the same
// "logged X ago" feedback elsewhere.
export function formatPretty(d: Date, showTime: boolean): string {
  const now = new Date();
  const sameDay = isSameLocalDay(d, now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = isSameLocalDay(d, yesterday);
  const dayPart = sameDay
    ? 'Today'
    : isYesterday
    ? 'Yesterday'
    : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (!showTime) return dayPart;
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${dayPart} · ${timePart}`;
}

// "Logged just now" / "Logged 2 days ago for Apr 18" — short subtitle the
// caller can show on a success toast or in a list row to confirm what was
// actually saved.
export function describeBackdate(d: Date): string {
  const now = Date.now();
  const diffMin = Math.round((now - d.getTime()) / 60000);
  if (diffMin < 2) return 'Logged just now';
  if (diffMin < 60) return `Logged ${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `Logged ${diffHr}h ago`;
  const diffDays = Math.round(diffHr / 24);
  // Include the weekday so users can spot a wrong-date save at a glance —
  // "Mon, Apr 21" reads cleanly; "2026-04-21" forces them to think.
  return `Logged ${diffDays} day${diffDays === 1 ? '' : 's'} ago for ${d.toLocaleDateString(
    'en-US',
    { weekday: 'short', month: 'short', day: 'numeric' }
  )}`;
}

// Two Dates fall on the same local-time calendar day. Exported so callers
// (Log Metric, etc.) can run "already logged today?" duplicate checks
// against a chosen taken_at without re-implementing the comparison.
export function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function labelStyle(t: ReturnType<typeof useTheme>['t']) {
  return {
    fontSize: 10,
    color: t.ink3,
    fontFamily: font.sansSemi,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  };
}

function pillReadout(t: ReturnType<typeof useTheme>['t']) {
  return {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: t.surfaceAlt,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
}

function readoutStyle(t: ReturnType<typeof useTheme>['t']) {
  return {
    flex: 1,
    textAlign: 'center' as const,
    fontSize: 16,
    fontFamily: font.monoSemi,
    color: t.ink,
  };
}

function Stepper({
  onPress,
  a11y,
  children,
}: {
  onPress: () => void;
  a11y: string;
  children: string;
}) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.md,
        backgroundColor: t.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 18, color: t.ink, fontFamily: font.sansSemi }}>{children}</Text>
    </Pressable>
  );
}

function SmallStepper({
  onPress,
  a11y,
  children,
}: {
  onPress: () => void;
  a11y: string;
  children: string;
}) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={{
        width: 32,
        height: 32,
        borderRadius: radius.sm,
        backgroundColor: t.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 16, color: t.ink }}>{children}</Text>
    </Pressable>
  );
}
