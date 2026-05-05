// Editorial schedule list row. Time on the left in mono, serif title +
// mono detail in the middle, status keyword on the right. Hairline
// dividers between rows; the surrounding list owns those. Completed
// rows render at low opacity so the eye flows past them to "next".
import { Pressable, Text, View } from 'react-native';
import { useEditorialTheme } from '../../lib/design/theme';

export type ScheduleStatus = 'completed' | 'next' | 'upcoming' | 'overdue';

export function ScheduleItem({
  time,
  title,
  detail,
  caption,
  status,
  onPress,
}: {
  time: string;
  title: string;
  detail?: string;
  /** Optional eyebrow above the title — used for phase labels like
   *  "MAINTENANCE · WK 5 / 18" on phased cycle peptides. Mono uppercase,
   *  brass-tinted on the active row, ink3 on completed rows. */
  caption?: string;
  status: ScheduleStatus;
  onPress?: () => void;
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
        {detail ? (
          <Text
            style={{
              fontFamily: theme.typography.bodySm.fontFamily,
              fontSize: theme.typography.bodySm.fontSize,
              lineHeight: theme.typography.bodySm.lineHeight,
              color: theme.colors.ink3,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {detail}
          </Text>
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
    </Pressable>
  );
}
