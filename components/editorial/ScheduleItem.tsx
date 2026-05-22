// Editorial schedule list row. Time on the left in mono, serif title +
// mono detail in the middle, status keyword on the right. Hairline
// dividers between rows; the surrounding list owns those. Completed
// rows render at low opacity so the eye flows past them to "next".
import { Pressable, Text, View } from 'react-native';
import { useEditorialTheme } from '../../lib/design/theme';
import { DoseValue } from './DoseUnitChip';

export type ScheduleStatus = 'completed' | 'next' | 'upcoming' | 'overdue';

export function ScheduleItem({
  time,
  title,
  detail,
  doseMcg,
  caption,
  status,
  onPress,
  onLongPress,
}: {
  time: string;
  title: string;
  /** Trailing detail after the dose chip ("· daily", "· skipped",
   *  "· IM · L thigh"). Don't include the dose value here — pass it
   *  via doseMcg so the global unit chip can render inline. */
  detail?: string;
  /** When provided, renders a tappable dose value + unit chip before the
   *  detail string. Tapping the chip cycles the global dose-unit pref. */
  doseMcg?: number;
  /** Optional eyebrow above the title — used for phase labels like
   *  "MAINTENANCE · WK 5 / 18" on phased cycle peptides. Mono uppercase,
   *  brass-tinted on the active row, ink3 on completed rows. */
  caption?: string;
  status: ScheduleStatus;
  onPress?: () => void;
  /** Optional long-press handler — Today uses this to open the skip
   *  sheet when the user holds an upcoming row. Pass alongside
   *  `onPress` to make the row both short-press and long-press
   *  reactive without an outer wrapper. */
  onLongPress?: () => void;
}) {
  const theme = useEditorialTheme();
  const completed = status === 'completed';
  const overdue = status === 'overdue';

  const statusLabel: Record<ScheduleStatus, string> = {
    completed: 'LOGGED',
    next: 'NEXT',
    upcoming: 'UPCOMING',
    overdue: 'OVERDUE',
  };
  const statusColor =
    status === 'completed'
      ? theme.colors.ink4
      : status === 'next'
      ? theme.colors.stateOptimal
      : status === 'overdue'
      ? theme.colors.stateWarn
      : theme.colors.ink3;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`${title} at ${time}, ${statusLabel[status].toLowerCase()}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        gap: 14,
        opacity: completed ? 0.4 : 1,
      }}
    >
      <Text
        style={{
          fontFamily: theme.typography.dataMd.fontFamily,
          fontSize: theme.typography.dataMd.fontSize,
          letterSpacing: theme.typography.dataMd.letterSpacing,
          color: theme.colors.ink2,
          width: 48,
        }}
      >
        {time}
      </Text>
      <View style={{ flex: 1 }}>
        {caption ? (
          <Text
            style={{
              fontFamily: theme.typography.labelSm.fontFamily,
              fontSize: theme.typography.labelSm.fontSize,
              letterSpacing: theme.typography.labelSm.letterSpacing,
              textTransform: 'uppercase',
              color: completed ? theme.colors.ink4 : theme.colors.brand,
              marginBottom: 2,
            }}
            numberOfLines={1}
          >
            {caption}
          </Text>
        ) : null}
        <Text
          style={{
            fontFamily: theme.fraunces('Fraunces_400Regular'),
            fontSize: 19,
            lineHeight: 24,
            letterSpacing: -0.3,
            color: overdue ? theme.colors.stateWarn : theme.colors.ink1,
            textDecorationLine: completed ? 'line-through' : 'none',
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {detail || typeof doseMcg === 'number' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 }}>
            {typeof doseMcg === 'number' ? (
              <DoseValue
                mcg={doseMcg}
                valueStyle={{
                  fontFamily: theme.typography.bodySm.fontFamily,
                  fontSize: theme.typography.bodySm.fontSize,
                  lineHeight: theme.typography.bodySm.lineHeight,
                  color: theme.colors.ink3,
                }}
              />
            ) : null}
            {detail ? (
              <Text
                style={{
                  fontFamily: theme.typography.bodySm.fontFamily,
                  fontSize: theme.typography.bodySm.fontSize,
                  lineHeight: theme.typography.bodySm.lineHeight,
                  color: theme.colors.ink3,
                  flexShrink: 1,
                }}
                numberOfLines={1}
              >
                {typeof doseMcg === 'number' ? ` · ${detail}` : detail}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      <Text
        style={{
          fontFamily: theme.typography.labelSm.fontFamily,
          fontSize: theme.typography.labelSm.fontSize,
          letterSpacing: theme.typography.labelSm.letterSpacing,
          color: statusColor,
          textTransform: 'uppercase',
        }}
      >
        {statusLabel[status]}
      </Text>
      {/* Visible chevron so users learn the row is tappable. Brass on
          actionable rows (next/upcoming/overdue → opens Log Dose with
          schedule prefill); muted ink4 on completed rows so it still
          reads as tappable (opens DoseDetailSheet) without competing
          with active items. */}
      {onPress ? (
        <Text
          style={{
            marginLeft: 8,
            fontFamily: theme.fraunces('Fraunces_300Light'),
            fontSize: 22,
            lineHeight: 22,
            color: completed ? theme.colors.ink4 : theme.colors.brand,
          }}
        >
          ›
        </Text>
      ) : null}
    </Pressable>
  );
}
