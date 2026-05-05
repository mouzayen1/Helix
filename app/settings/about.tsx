// About — editorial rebuild.
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { ResearchBanner } from '../../components/Primitives';
import { useEditorialTheme } from '../../lib/design/theme';
import { DISCLAIMER_ONBOARDING, TERMS_FULL, TERMS_VERSION } from '../../lib/disclaimers';

export default function About() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: ed.colors.bg }}>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: 24,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text
            style={{
              fontFamily: ed.fraunces('Fraunces_300Light'),
              fontSize: 26,
              color: ed.colors.ink2,
              lineHeight: 26,
            }}
          >
            ←
          </Text>
        </Pressable>
      </View>

      <ResearchBanner />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: insets.bottom + 64,
        }}
        showsVerticalScrollIndicator={false}
      >
        <EditorialHeadline size="title1">{`About *Helix*.`}</EditorialHeadline>

        <View style={{ marginTop: 32 }}>
          <EyebrowLabel withRule>What Helix is</EyebrowLabel>
          <Text
            style={{
              marginTop: 14,
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 16,
              lineHeight: 24,
              letterSpacing: -0.2,
              color: ed.colors.ink1,
            }}
          >
            {DISCLAIMER_ONBOARDING}
          </Text>
        </View>

        <View style={{ marginTop: 28 }}>
          <Text
            style={{
              fontFamily: ed.typography.label.fontFamily,
              fontSize: ed.typography.label.fontSize,
              letterSpacing: ed.typography.label.letterSpacing,
              color: ed.colors.stateWarn,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Not for human use
          </Text>
          <View
            style={{
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: ed.colors.stateWarn,
              paddingVertical: 16,
            }}
          >
            <Text
              style={{
                fontFamily: ed.fraunces('Fraunces_400Regular'),
                fontSize: 15,
                lineHeight: 23,
                color: ed.colors.ink1,
              }}
            >
              Peptides described in this app are research chemicals. In most jurisdictions they
              are not approved by the FDA, EMA, or equivalent regulator for human use. Helix and
              its creators are not liable for any administration, adverse reaction, illness, or
              outcome arising from your use. You are solely responsible for your decisions.
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 28 }}>
          <EyebrowLabel withRule>App version</EyebrowLabel>
          <Text
            style={{
              marginTop: 14,
              fontFamily: ed.fraunces('Fraunces_300Light'),
              fontSize: 36,
              letterSpacing: -1,
              color: ed.colors.ink1,
            }}
          >
            {Constants.expoConfig?.version ?? '0.0.0'}
          </Text>
          <Text
            style={{
              marginTop: 4,
              fontFamily: ed.typography.labelSm.fontFamily,
              fontSize: ed.typography.labelSm.fontSize,
              letterSpacing: ed.typography.labelSm.letterSpacing,
              color: ed.colors.ink3,
              textTransform: 'uppercase',
            }}
          >
            Terms v{TERMS_VERSION}
          </Text>
        </View>

        <View style={{ marginTop: 28 }}>
          <EyebrowLabel withRule>Data stays local</EyebrowLabel>
          <Text
            style={{
              marginTop: 14,
              fontFamily: ed.typography.bodyMd.fontFamily,
              fontSize: 15,
              lineHeight: 23,
              color: ed.colors.ink2,
            }}
          >
            This build runs entirely on your device. Nothing is transmitted. Your data is yours:
            export from Settings → Export, or delete everything from Settings → Delete all data.
          </Text>
        </View>

        <View style={{ marginTop: 28 }}>
          <EyebrowLabel withRule>Full terms of use</EyebrowLabel>
          <Text
            style={{
              marginTop: 14,
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 13,
              lineHeight: 20,
              color: ed.colors.ink2,
            }}
          >
            {TERMS_FULL}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
