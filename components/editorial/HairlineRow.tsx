// 1-px hairline divider. Used liberally — the editorial system is
// hairline-driven instead of card-driven, so this lives almost
// everywhere a Card would have lived.
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useEditorialTheme } from '../../lib/design/theme';
import { spacing as space } from '../../lib/design/tokens';

export function HairlineRow({
  strong = false,
  marginVertical = '0',
  style,
}: {
  strong?: boolean;
  marginVertical?: keyof typeof space;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useEditorialTheme();
  return (
    <View
      style={[
        {
          height: 1,
          backgroundColor: strong ? colors.lineStrong : colors.line,
          marginVertical: space[marginVertical],
        },
        style,
      ]}
      accessibilityRole="none"
    />
  );
}
