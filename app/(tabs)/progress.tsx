// Progress — placeholder for Phase 2 (spec §10.9).
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { font, space } from '../../theme/tokens';

export default function ProgressScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.bg,
        paddingTop: insets.top + 20,
        paddingHorizontal: space.xl,
      }}
    >
      <Text style={{ fontSize: 32, fontFamily: font.sansBold, color: t.ink, letterSpacing: -0.8 }}>
        Progress
      </Text>
      <Text style={{ fontSize: 14, color: t.ink3, marginTop: 4 }}>
        Charts, trends, and journal summaries arrive in Phase 2.
      </Text>
    </View>
  );
}
