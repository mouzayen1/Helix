// About — spec v2.0 §10.
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronLeft } from '../../components/Icons';
import { DISCLAIMER_ONBOARDING } from '../../lib/disclaimers';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

export default function About() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      <View
        style={{
          paddingTop: insets.top + space.sm,
          paddingBottom: space.md,
          paddingHorizontal: space.xl,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconChevronLeft size={18} color={t.ink2} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: space.xl, gap: space.lg }}>
        <Text style={{ fontSize: 28, fontFamily: font.sansBold, color: t.ink, letterSpacing: -0.6 }}>
          About Helix
        </Text>

        <View
          style={{
            padding: space.md,
            borderRadius: radius.md,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.line,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              letterSpacing: 0.9,
              fontFamily: font.sansSemi,
              color: t.ink3,
              textTransform: 'uppercase',
            }}
          >
            What Helix is
          </Text>
          <Text style={{ color: t.ink2, fontSize: 14, lineHeight: 21, marginTop: 6 }}>
            {DISCLAIMER_ONBOARDING}
          </Text>
        </View>

        <View
          style={{
            padding: space.md,
            borderRadius: radius.md,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.line,
            gap: 4,
          }}
        >
          <Text style={{ color: t.ink, fontSize: 14, fontFamily: font.sansSemi }}>Version</Text>
          <Text style={{ color: t.ink3, fontSize: 13, fontFamily: font.mono }}>
            {Constants.expoConfig?.version ?? '0.0.0'}
          </Text>
        </View>

        <View
          style={{
            padding: space.md,
            borderRadius: radius.md,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.line,
            gap: 4,
          }}
        >
          <Text style={{ color: t.ink, fontSize: 14, fontFamily: font.sansSemi }}>
            Data stays local
          </Text>
          <Text style={{ color: t.ink2, fontSize: 13, lineHeight: 19 }}>
            This build runs entirely on your device. Nothing is sent anywhere.
            Cloud sync with accounts is coming in a future update.
          </Text>
        </View>

        <View
          style={{
            padding: space.md,
            borderRadius: radius.md,
            backgroundColor: t.warnSoft + '80',
            borderWidth: 1,
            borderColor: t.warn + '40',
          }}
        >
          <Text style={{ color: t.ink2, fontSize: 12, lineHeight: 18 }}>
            All content in Helix is framed as published research literature. Dosing
            ranges are labeled research ranges, not recommendations. Nothing in this
            app replaces guidance from a licensed clinician.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
