// Terms — editorial rebuild. The terms scroll view is the focal point;
// chrome around it is hairline-quiet so the reader's eye stays on the
// terms text itself.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { useEditorialTheme } from '../../lib/design/theme';
import { TERMS_FULL, TERMS_VERSION } from '../../lib/disclaimers';
import { useProfile } from '../../lib/profile-context';

export default function Terms() {
  const ed = useEditorialTheme();
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
        Step 3 of 5
      </Text>
      <View style={{ marginTop: 18 }}>
        <EditorialHeadline size="title1">{`Terms and *liability*.`}</EditorialHeadline>
      </View>

      <ScrollView
        style={{
          flex: 1,
          marginTop: 24,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: ed.colors.line,
        }}
        contentContainerStyle={{ paddingVertical: 18 }}
        showsVerticalScrollIndicator
      >
        <Text
          style={{
            fontFamily: ed.fraunces('Fraunces_400Regular'),
            fontSize: 14,
            lineHeight: 22,
            letterSpacing: -0.1,
            color: ed.colors.ink2,
          }}
        >
          {TERMS_FULL}
        </Text>
      </ScrollView>

      <Pressable
        onPress={() => setChecked((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={{
          marginTop: 14,
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
            fontSize: 14,
            lineHeight: 21,
            color: ed.colors.ink1,
          }}
        >
          I have read and agree to the Terms of Use. I confirm I am 18+, I understand Helix is
          for research purposes only, and I accept that Helix and its creators are not liable for
          any outcome of my use.
        </Text>
      </Pressable>

      <View style={{ marginTop: 14 }}>
        <EditorialButton fullWidth onPress={proceed} disabled={!checked}>
          I agree — continue
        </EditorialButton>
      </View>
    </View>
  );
}
