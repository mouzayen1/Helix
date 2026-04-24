// About — full liability posture. Spec v2.0 §15 + liability option (b).
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronLeft } from '../../components/Icons';
import { ResearchBanner } from '../../components/Primitives';
import { DISCLAIMER_ONBOARDING, TERMS_FULL, TERMS_VERSION } from '../../lib/disclaimers';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

export default function About() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
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

      <ResearchBanner />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingTop: space.md,
          paddingBottom: insets.bottom + 40,
          gap: space.md,
        }}
      >
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
            backgroundColor: t.dangerSoft,
            borderLeftWidth: 3,
            borderLeftColor: t.danger,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              letterSpacing: 0.9,
              fontFamily: font.sansSemi,
              color: t.danger,
              textTransform: 'uppercase',
            }}
          >
            Not for human use
          </Text>
          <Text style={{ color: t.ink, fontSize: 14, lineHeight: 21, marginTop: 6 }}>
            Peptides described in this app are research chemicals. In most
            jurisdictions they are not approved by the FDA, EMA, or equivalent
            regulator for human use. Helix and its creators are not liable for
            any administration, adverse reaction, illness, or outcome arising
            from your use. You are solely responsible for your decisions.
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
            App version
          </Text>
          <Text style={{ color: t.ink3, fontSize: 13, fontFamily: font.mono }}>
            {Constants.expoConfig?.version ?? '0.0.0'} · terms v{TERMS_VERSION}
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
            This build runs entirely on your device. Nothing is transmitted.
            Your data is yours: export from Settings → Export, or delete
            everything from Settings → Delete all data.
          </Text>
        </View>

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
              marginBottom: 8,
            }}
          >
            Full terms of use
          </Text>
          <Text style={{ color: t.ink2, fontSize: 12, lineHeight: 18 }}>
            {TERMS_FULL}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
