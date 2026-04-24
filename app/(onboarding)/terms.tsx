// Terms & Liability — onboarding step 5. Records acceptance timestamp.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TERMS_FULL, TERMS_VERSION } from '../../lib/disclaimers';
import { useProfile } from '../../lib/profile-context';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

export default function Terms() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { update } = useProfile();
  const [checked, setChecked] = useState(false);

  const proceed = async () => {
    if (!checked) return;
    const now = new Date().toISOString();
    await update({ terms_version: TERMS_VERSION, terms_accepted_at: now });
    router.push('/(onboarding)/preferences');
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.bg,
        paddingTop: insets.top + space.xl,
        paddingBottom: insets.bottom + space.xl,
        paddingHorizontal: space.xl,
      }}
    >
      <Text style={{ color: t.ink3, fontSize: 11, fontFamily: font.sansSemi, letterSpacing: 1.2 }}>
        STEP 3 OF 5
      </Text>

      <Text
        style={{
          marginTop: space.lg,
          fontSize: 28,
          lineHeight: 34,
          fontFamily: font.sansBold,
          color: t.ink,
          letterSpacing: -0.6,
        }}
      >
        Terms of use{'\n'}and liability.
      </Text>

      <ScrollView
        style={{
          flex: 1,
          marginTop: space.lg,
          backgroundColor: t.surface,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: t.line,
          padding: space.md,
        }}
        showsVerticalScrollIndicator
      >
        <Text style={{ color: t.ink2, fontSize: 13, lineHeight: 19 }}>{TERMS_FULL}</Text>
      </ScrollView>

      <Pressable
        onPress={() => setChecked((v) => !v)}
        style={{
          marginTop: space.md,
          flexDirection: 'row',
          gap: space.md,
          alignItems: 'flex-start',
          padding: space.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: checked ? t.accent : t.line,
          backgroundColor: checked ? t.accentSoft : 'transparent',
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            borderWidth: 2,
            borderColor: checked ? t.accent : t.ink4,
            backgroundColor: checked ? t.accent : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 1,
          }}
        >
          {checked ? (
            <Text style={{ color: '#fff', fontSize: 12, fontFamily: font.sansBold }}>✓</Text>
          ) : null}
        </View>
        <Text style={{ flex: 1, color: t.ink, fontSize: 14, lineHeight: 20 }}>
          I have read and agree to the Terms of Use. I confirm I am 18+, I
          understand Helix is for research purposes only, and I accept that
          Helix and its creators are not liable for any outcome of my use.
        </Text>
      </Pressable>

      <Pressable
        onPress={proceed}
        disabled={!checked}
        style={{
          marginTop: space.md,
          backgroundColor: checked ? t.ink : t.surfaceAlt,
          padding: space.lg,
          borderRadius: radius.md,
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            color: checked ? t.bg : t.ink3,
            fontSize: 16,
            fontFamily: font.sansSemi,
          }}
        >
          I agree — continue
        </Text>
      </Pressable>
    </View>
  );
}
