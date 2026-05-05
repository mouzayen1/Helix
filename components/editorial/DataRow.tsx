// Editorial input row used on the Reconstitute screen + similar
// list-style data rows. Mono uppercase label on the left, serif value
// on the right with a small mono unit suffix. Tap-to-adjust and the
// optional +/- pair both surface only when onAdjust is provided.
import { Pressable, Text, View } from 'react-native';
import { useEditorialTheme } from '../../lib/design/theme';

export function DataRow({
  label,
  value,
  unit,
  onAdjust,
  onPress,
}: {
  label: string;
  value: string | number;
  unit?: string;
  onAdjust?: (delta: 1 | -1) => void;
  onPress?: () => void;
}) {
  const theme = useEditorialTheme();
  const valueStr = String(value);

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 22,
        gap: 12,
      }}
    >
      <Text
        style={{
          flex: 1,
          fontFamily: theme.typography.label.fontFamily,
          fontSize: theme.typography.label.fontSize,
          letterSpacing: theme.typography.label.letterSpacing,
          color: theme.colors.ink3,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      {onAdjust ? (
        <Pressable
          onPress={() => onAdjust(-1)}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label.toLowerCase()}`}
          hitSlop={8}
        >
          <Text
            style={{
              fontFamily: theme.typography.dataLg.fontFamily,
              fontSize: 22,
              color: theme.colors.ink3,
              paddingHorizontal: 10,
            }}
          >
            −
          </Text>
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text
          style={{
            fontFamily: theme.fraunces('Fraunces_400Regular'),
            fontSize: 28,
            letterSpacing: -0.5,
            color: theme.colors.ink1,
          }}
        >
          {valueStr}
        </Text>
        {unit ? (
          <Text
            style={{
              marginLeft: 6,
              fontFamily: theme.typography.label.fontFamily,
              fontSize: theme.typography.label.fontSize,
              letterSpacing: theme.typography.label.letterSpacing,
              color: theme.colors.ink3,
              textTransform: 'uppercase',
            }}
          >
            {unit}
          </Text>
        ) : null}
      </View>
      {onAdjust ? (
        <Pressable
          onPress={() => onAdjust(1)}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label.toLowerCase()}`}
          hitSlop={8}
        >
          <Text
            style={{
              fontFamily: theme.typography.dataLg.fontFamily,
              fontSize: 22,
              color: theme.colors.ink3,
              paddingHorizontal: 10,
            }}
          >
            +
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
        {content}
      </Pressable>
    );
  }
  return content;
}
