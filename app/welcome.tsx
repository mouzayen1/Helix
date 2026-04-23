// Welcome — pre-onboarding splash per spec v2.0 §10 AUTH & ONBOARDING.
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, space } from '../theme/tokens';

function HelixMark({ color }: { color: string }) {
  return (
    <Svg width={64} height={64} viewBox="0 0 64 64">
      <Path
        d="M18 10 Q32 32 18 54 M46 10 Q32 32 46 54 M18 24 L46 24 M18 40 L46 40"
        stroke={color}
        strokeWidth={3.5}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

export default function Welcome() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.bg,
        paddingTop: insets.top + space['2xl'],
        paddingBottom: insets.bottom + space.xl,
        paddingHorizontal: space.xl,
      }}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <HelixMark color={t.accent} />
        <Text
          style={{
            marginTop: space['2xl'],
            fontSize: 36,
            lineHeight: 40,
            fontFamily: font.sansBold,
            color: t.ink,
            letterSpacing: -1,
            textAlign: 'center',
          }}
        >
          Precise peptide{'\n'}tracking and research,{'\n'}in one place.
        </Text>
        <Text
          style={{
            marginTop: space.lg,
            fontSize: 15,
            lineHeight: 22,
            color: t.ink2,
            textAlign: 'center',
            maxWidth: 320,
          }}
        >
          A research-grade library and a precise log of every dose, cycle, and vial.
        </Text>
      </View>

      <View style={{ gap: space.md }}>
        <Pressable
          onPress={() => router.push('/(onboarding)/age-gate')}
          style={{
            backgroundColor: t.ink,
            padding: space.lg,
            borderRadius: radius.lg,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: t.bg, fontSize: 16, fontFamily: font.sansSemi }}>
            Get started
          </Text>
        </Pressable>
        <Text
          style={{
            textAlign: 'center',
            color: t.ink3,
            fontSize: 11,
            fontFamily: font.sansMed,
            letterSpacing: 0.3,
            marginTop: space.sm,
          }}
        >
          Educational / research tracking tool · Not medical advice · 18+
        </Text>
      </View>
    </View>
  );
}
