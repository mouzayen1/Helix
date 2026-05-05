// Two button variants only. No ghost. No icon-only. Sharp corners.
//
// Primary: white-on-black (or near-black-on-cream in light mode),
// uppercase Inter with extra letter-spacing. Used for the dominant
// action on a screen.
//
// Secondary: transparent fill, hairline border, ink2 text. Used for
// the lesser of two paired actions.
import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useEditorialTheme } from '../../lib/design/theme';

export function EditorialButton({
  children,
  variant = 'primary',
  fullWidth = false,
  disabled = false,
  onPress,
  style,
}: {
  children: string;
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, typography } = useEditorialTheme();
  const primary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[
        {
          paddingHorizontal: 24,
          paddingVertical: 16,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: fullWidth ? 'stretch' : 'center',
          backgroundColor: primary
            ? disabled
              ? colors.inkDisabled
              : colors.ink1
            : 'transparent',
          borderWidth: primary ? 0 : 1,
          borderColor: colors.lineStrong,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: typography.label.fontFamily,
          fontSize: 12,
          letterSpacing: 1.8,
          color: primary ? colors.bg : colors.ink2,
          textTransform: 'uppercase',
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}
