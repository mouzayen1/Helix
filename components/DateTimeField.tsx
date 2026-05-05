// Reusable date/time picker — editorial restyle. Same API as the
// pre-overhaul version: collapsed pill expands to quick chips + day
// stepper + (optional) hour/minute steppers.
//
// Three quick chips (Now · Yesterday · 2 days ago) cover the 95% case.
// Day + time steppers underneath let users dial to any timestamp inside
// [minDaysBack ago, now].
//
// Caveat: this component owns NO state of its own. Parents track
// `value` and re-render. Keeps the call sites trivially testable.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useEditorialTheme } from '../lib/design/theme';

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
  const ed = useEditorialTheme();
  const [editing, setEditing] = useState(false);
  const showTime = mode === 'datetime';

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
      {/* Collapsed summary row */}
      <Pressable
        onPress={() => setEditing((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatPretty(value, showTime)}. Tap to edit.`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 14,
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: ed.typography.label.fontFamily,
              fontSize: ed.typography.label.fontSize,
              letterSpacing: ed.typography.label.letterSpacing,
              color: ed.colors.ink3,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            {label}
          </Text>
          <Text
            style={{
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 22,
              letterSpacing: -0.4,
              color: ed.colors.ink1,
            }}
          >
            {formatPretty(value, showTime)}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: ed.typography.label.fontFamily,
            fontSize: ed.typography.label.fontSize,
            letterSpacing: ed.typography.label.letterSpacing,
            color: ed.colors.brand,
            textTransform: 'uppercase',
          }}
        >
          {editing ? 'Done' : 'Edit'}
        </Text>
      </Pressable>

      {editing ? (
        <View
          style={{
            paddingVertical: 14,
            borderTopWidth: 1,
            borderColor: ed.colors.line,
            gap: 18,
          }}
        >
          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontFamily: ed.typography.labelSm.fontFamily,
                fontSize: ed.typography.labelSm.fontSize,
                letterSpacing: ed.typography.labelSm.letterSpacing,
                color: ed.colors.ink3,
                textTransform: 'uppercase',
              }}
            >
              Quick
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {QUICK_CHIPS.map((chip) => (
                <Pressable
                  key={chip.label}
                  onPress={() => onChange(chip.build())}
                  accessibilityRole="button"
                  accessibilityLabel={`Set to ${chip.label}`}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: ed.colors.lineStrong,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: ed.typography.labelSm.fontFamily,
                      fontSize: ed.typography.labelSm.fontSize,
                      letterSpacing: ed.typography.labelSm.letterSpacing,
                      color: ed.colors.ink2,
                      textTransform: 'uppercase',
                    }}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontFamily: ed.typography.labelSm.fontFamily,
                fontSize: ed.typography.labelSm.fontSize,
                letterSpacing: ed.typography.labelSm.letterSpacing,
                color: ed.colors.ink3,
                textTransform: 'uppercase',
              }}
            >
              Day
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable onPress={() => stepDay(-1)} hitSlop={8} accessibilityLabel="Previous day">
                <Text
                  style={{
                    fontFamily: ed.typography.dataLg.fontFamily,
                    fontSize: 22,
                    color: ed.colors.ink3,
                    paddingHorizontal: 14,
                  }}
                >
                  −
                </Text>
              </Pressable>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text
                  style={{
                    fontFamily: ed.fraunces('Fraunces_400Regular'),
                    fontSize: 19,
                    color: ed.colors.ink1,
                  }}
                >
                  {value.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
              <Pressable onPress={() => stepDay(1)} hitSlop={8} accessibilityLabel="Next day">
                <Text
                  style={{
                    fontFamily: ed.typography.dataLg.fontFamily,
                    fontSize: 22,
                    color: ed.colors.ink3,
                    paddingHorizontal: 14,
                  }}
                >
                  +
                </Text>
              </Pressable>
            </View>
          </View>

          {showTime ? (
            <View style={{ flexDirection: 'row', gap: 18 }}>
              <UnitStepper
                label="Hour"
                value={value.getHours().toString().padStart(2, '0')}
                onMinus={() => stepHour(-1)}
                onPlus={() => stepHour(1)}
              />
              <UnitStepper
                label="Min"
                value={value.getMinutes().toString().padStart(2, '0')}
                minusLabel="−5"
                plusLabel="+5"
                onMinus={() => stepMinute(-5)}
                onPlus={() => stepMinute(5)}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function UnitStepper({
  label,
  value,
  onMinus,
  onPlus,
  minusLabel = '−',
  plusLabel = '+',
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  minusLabel?: string;
  plusLabel?: string;
}) {
  const ed = useEditorialTheme();
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <Text
        style={{
          fontFamily: ed.typography.labelSm.fontFamily,
          fontSize: ed.typography.labelSm.fontSize,
          letterSpacing: ed.typography.labelSm.letterSpacing,
          color: ed.colors.ink3,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={onMinus} hitSlop={8}>
          <Text
            style={{
              fontFamily: ed.typography.dataLg.fontFamily,
              fontSize: 18,
              color: ed.colors.ink3,
              paddingHorizontal: 10,
            }}
          >
            {minusLabel}
          </Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 22,
              color: ed.colors.ink1,
            }}
          >
            {value}
          </Text>
        </View>
        <Pressable onPress={onPlus} hitSlop={8}>
          <Text
            style={{
              fontFamily: ed.typography.dataLg.fontFamily,
              fontSize: 18,
              color: ed.colors.ink3,
              paddingHorizontal: 10,
            }}
          >
            {plusLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// "Today, 3:42 PM" / "Yesterday, 8:00 AM" / "Sat, Apr 19" depending on
// the offset and whether time is being shown.
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

// Past-tense subtitle for confirming what was already saved.
export function describeBackdate(d: Date): string {
  const now = Date.now();
  const diffMin = Math.round((now - d.getTime()) / 60000);
  if (diffMin < 2) return 'Logged just now';
  if (diffMin < 60) return `Logged ${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `Logged ${diffHr}h ago`;
  const diffDays = Math.round(diffHr / 24);
  return `Logged ${diffDays} day${diffDays === 1 ? '' : 's'} ago for ${d.toLocaleDateString(
    'en-US',
    { weekday: 'short', month: 'short', day: 'numeric' }
  )}`;
}

// Neutral, present-tense form for pre-save confirmation prompts.
export function describeTargetDate(d: Date, includeTime = true): string {
  const datePart = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timePart = includeTime
    ? ` at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : '';
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  let ago = '';
  if (diffMin >= 60 * 24) {
    const diffDays = Math.round(diffMin / (60 * 24));
    ago = ` (${diffDays} day${diffDays === 1 ? '' : 's'} ago)`;
  } else if (diffMin >= 60) {
    const diffHr = Math.round(diffMin / 60);
    ago = ` (${diffHr}h ago)`;
  }
  return `${datePart}${timePart}${ago}`;
}

export function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
