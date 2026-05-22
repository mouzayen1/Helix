// Acknowledge — editorial rebuild. Hanging serif numerals for the
// three principles, editorial checkbox for the acceptance, single
// EditorialButton primary at the bottom.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { useEditorialTheme } from '../../lib/design/theme';
import { useProfile } from '../../lib/profile-context';

const BULLETS = [
  "We won't tell you what to take.",
  "We won't tell you how much.",
  'We will help you track what you are doing and read the research behind it.',
];

export default function Acknowledge() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { update } = useProfile();
  const [checked, setChecked] = useState(false);

  const proceed = async () => {
    if (!checked) return;
    const now = new Date().toISOString();
    await update({ disclaimer_accepted_at: now });
    router.push('/(onboarding)/terms');
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: ed.colors.bg,
        paddingTop: insets.top + 28,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 24,
      }}
    >
      <Text
        style={{
          fontFamily: ed.typography.eyebrow.fontFamily,
          fontSize: ed.typography.eyebrow.fontSize,
          letterSpacing: ed.typography.eyebrow.letterSpacing,
          color: ed.colors.ink3,
          textTransform: 'uppercase',
        }}
      >
        Step 2 of 5
      </Text>
      <View style={{ flex: 1, gap: 32, paddingTop: 28 }}>
        <EditorialHeadline size="display">{`Helix does not give *medical* advice.`}</EditorialHeadline>

        <View style={{ gap: 18 }}>
          {BULLETS.map((b, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 14 }}>
              <Text
                style={{
                  width: 24,
                  fontFamily: ed.fraunces('Fraunces_300Light'),
                  fontSize: 28,
                  color: ed.colors.brand,
                  lineHeight: 30,
                }}
              >
                {i + 1}
              </Text>
              <Text
                style={{
                  flex: 1,
                  fontFamily: ed.fraunces('Fraunces_400Regular'),
                  fontSize: 17,
                  lineHeight: 26,
                  letterSpacing: -0.2,
                  color: ed.colors.ink1,
                }}
              >
                {b}
              </Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => setChecked((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          style={{
            flexDirection: 'row',
            gap: 14,
            alignItems: 'flex-start',
            paddingVertical: 14,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: checked ? ed.colors.brand : ed.colors.lineStrong,
          }}
        >
          <View
            style={{
              width: 18,
              height: 18,
              marginTop: 4,
              borderWidth: 1,
              borderColor: checked ? ed.colors.brand : ed.colors.lineStrong,
              backgroundColor: checked ? ed.colors.brand : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {checked ? (
              <Text
                style={{
                  color: ed.colors.bg,
                  fontFamily: ed.typography.dataMd.fontFamily,
                  fontSize: 12,
                  lineHeight: 14,
                }}
              >
                ✓
              </Text>
            ) : null}
          </View>
          <Text
            style={{
              flex: 1,
              fontFamily: ed.typography.bodyMd.fontFamily,
              fontSize: 15,
              lineHeight: 22,
              color: ed.colors.ink1,
            }}
          >
            I understand Helix is an educational and tracking tool.
          </Text>
        </Pressable>
      </View>

      <EditorialButton fullWidth onPress={proceed} disabled={!checked}>
        Continue
      </EditorialButton>
    </View>
  );
}
