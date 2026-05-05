// Mono uppercase label, optionally with a hairline rule extending to
// the right edge of the container. Used as section opener throughout
// the editorial system ("YOUR JOURNEY", "TODAY'S SCHEDULE").
//
// The extending rule is a publication convention — it visually anchors
// the section without enclosing it in a card, which would break the
// hairline-driven layout.
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useEditorialTheme } from '../../lib/design/theme';

export function EyebrowLabel({
  children,
  withRule = false,
  align = 'left',
  style,
}: {
  children: string;
  withRule?: boolean;
  align?: 'left' | 'center';
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, typography } = useEditorialTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: align === 'center' ? 'center' : 'flex-start',
          gap: 12,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: typography.eyebrow.fontFamily,
          fontSize: typography.eyebrow.fontSize,
          lineHeight: typography.eyebrow.lineHeight,
          letterSpacing: typography.eyebrow.letterSpacing,
          color: colors.ink3,
          textTransform: 'uppercase',
        }}
      >
        {children}
      </Text>
      {withRule ? (
        <View
          style={{ flex: 1, height: 1, backgroundColor: colors.line }}
          accessibilityRole="none"
        />
      ) : null}
    </View>
  );
}
