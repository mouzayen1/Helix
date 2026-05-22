// Horizontal phase timeline used on Cycle Detail. A single hairline runs
// the width of the row; phase boundaries are tick marks above/below it.
// The currently-active phase gets a thicker hairline overlay in the
// brand brass color and a serif italic name; completed phases sit in
// ink3, upcoming in ink4. Day-range labels below each segment use mono.
//
// Phases are passed in order; each carries a duration in days. The
// timeline normalizes those into proportional widths — no absolute
// pixel math leaks into the caller.
import { Text, View } from 'react-native';
import { useEditorialTheme } from '../../lib/design/theme';

export type Phase = {
  name: string;
  days: number;
};

export function PhaseTimeline({
  phases,
  currentDay,
}: {
  phases: Phase[];
  // 1-indexed day within the entire cycle. If 0 or negative, the
  // timeline renders inert (no active highlight).
  currentDay: number;
}) {
  const theme = useEditorialTheme();
  const totalDays = phases.reduce((acc, p) => acc + p.days, 0);
  if (totalDays === 0) return null;

  // Walk phases to find which one currentDay falls inside, plus the
  // running start-day for each segment so labels can render "D1–D14".
  let runningStart = 1;
  const enriched = phases.map((p) => {
    const startDay = runningStart;
    const endDay = runningStart + p.days - 1;
    runningStart = endDay + 1;
    const isPast = currentDay > endDay;
    const isActive = currentDay >= startDay && currentDay <= endDay;
    return { ...p, startDay, endDay, isPast, isActive };
  });

  return (
    <View style={{ paddingVertical: 16 }}>
      {/* Phase names row — serif, italic for the active phase. */}
      <View style={{ flexDirection: 'row' }}>
        {enriched.map((p, i) => {
          const color = p.isActive
            ? theme.colors.brand
            : p.isPast
            ? theme.colors.ink3
            : theme.colors.ink4;
          const fontFamily = p.isActive
            ? theme.fraunces('Fraunces_400Regular_Italic')
            : theme.fraunces('Fraunces_400Regular');
          return (
            <View
              key={`name-${i}`}
              style={{
                flex: p.days,
                paddingHorizontal: 4,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily,
                  fontSize: 15,
                  letterSpacing: -0.2,
                  color,
                  textAlign: 'center',
                }}
                numberOfLines={1}
              >
                {p.name}
              </Text>
            </View>
          );
        })}
      </View>

      {/* The hairline rail itself. Each segment is its own slice so the
          active segment can render at a heavier weight in brass without
          drawing two overlapping lines. */}
      <View style={{ flexDirection: 'row', marginTop: 12, marginBottom: 12 }}>
        {enriched.map((p, i) => {
          const color = p.isActive
            ? theme.colors.brand
            : p.isPast
            ? theme.colors.lineStrong
            : theme.colors.line;
          const height = p.isActive ? 2 : 1;
          return (
            <View
              key={`rail-${i}`}
              style={{
                flex: p.days,
                height,
                backgroundColor: color,
                marginHorizontal: 1,
              }}
            />
          );
        })}
      </View>

      {/* Day-range labels in mono. */}
      <View style={{ flexDirection: 'row' }}>
        {enriched.map((p, i) => {
          const color = p.isActive
            ? theme.colors.ink2
            : p.isPast
            ? theme.colors.ink3
            : theme.colors.ink4;
          const range = p.days === 1 ? `D${p.startDay}` : `D${p.startDay}–${p.endDay}`;
          return (
            <View
              key={`days-${i}`}
              style={{
                flex: p.days,
                paddingHorizontal: 4,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: theme.typography.labelSm.fontFamily,
                  fontSize: theme.typography.labelSm.fontSize,
                  letterSpacing: theme.typography.labelSm.letterSpacing,
                  color,
                  textTransform: 'uppercase',
                }}
              >
                {range}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
