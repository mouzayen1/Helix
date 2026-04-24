// Acknowledge — spec v2.0 onboarding step 2. Legal / ethical disclosure.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '../../lib/profile-context';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

const BULLETS = [
  "We won't tell you what to take.",
  "We won't tell you how much.",
  'We will help you track what you are doing and read the research behind it.',
];

export default function Acknowledge() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { update } = useProfile();
  const [checked, setChecked] = useState(false);

  const proceed = async () => {
    if (!checked) return;
    const now = new Date().toISOString();
    await update({
      disclaimer_accepted_at: now,
    });
    router.push('/(onboarding)/terms');
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
        STEP 2 OF 5
      </Text>

      <View style={{ flex: 1, gap: space.xl, paddingTop: space.xl }}>
        <Text
          style={{
            fontSize: 34,
            lineHeight: 40,
            fontFamily: font.sansBold,
            color: t.ink,
            letterSpacing: -1,
          }}
        >
          Helix doesn't give{'\n'}medical advice.
        </Text>

        <View style={{ gap: space.md }}>
          {BULLETS.map((b, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                gap: space.md,
                paddingVertical: space.sm,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: t.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: t.accentInk, fontSize: 11, fontFamily: font.sansSemi }}>
                  {i + 1}
                </Text>
              </View>
              <Text style={{ flex: 1, color: t.ink2, fontSize: 15, lineHeight: 22 }}>
                {b}
              </Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => setChecked((v) => !v)}
          style={{
            flexDirection: 'row',
            gap: space.md,
            alignItems: 'flex-start',
            padding: space.lg,
            borderRadius: radius.lg,
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
              <Text style={{ color: '#fff', fontSize: 12, fontFamily: font.sansBold }}>
                ✓
              </Text>
            ) : null}
          </View>
          <Text style={{ flex: 1, color: t.ink, fontSize: 15, lineHeight: 22 }}>
            I understand Helix is an educational and tracking tool.
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={proceed}
        disabled={!checked}
        style={{
          backgroundColor: checked ? t.ink : t.surfaceAlt,
          padding: space.lg,
          borderRadius: radius.lg,
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
          Continue
        </Text>
      </Pressable>
    </View>
  );
}
