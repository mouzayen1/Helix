// Age gate — editorial rebuild. Mono step indicator, italic-emphasis
// serif headline, body in serif. CTAs use the editorial pair.
import { useRouter } from 'expo-router';
import { Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { useWideWeb } from '../../components/editorial/WebColumn';
import { useEditorialTheme } from '../../lib/design/theme';
import { getCurrentUserId } from '../../lib/db';
import { useProfile } from '../../lib/profile-context';
import { isAuthConfigured } from '../../lib/supabase';

export default function AgeGate() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { update } = useProfile();
  const wide = useWideWeb();

  const yes = async () => {
    if ((Platform.OS === 'web' || isAuthConfigured()) && !getCurrentUserId()) {
      router.replace('/(auth)/sign-up');
      return;
    }
    await update({ age_gate_accepted_at: new Date().toISOString() });
    router.push('/(onboarding)/acknowledge');
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: ed.colors.bg,
        paddingTop: wide ? 48 : insets.top + 28,
        paddingBottom: wide ? 48 : insets.bottom + 24,
        paddingHorizontal: wide ? 24 : 24,
        alignItems: wide ? 'center' : 'stretch',
        justifyContent: wide ? 'center' : 'flex-start',
      }}
    >
      <View style={{ width: '100%', maxWidth: wide ? 520 : undefined, flex: wide ? 0 : 1 }}>
        <Text
          style={{
            fontFamily: ed.typography.eyebrow.fontFamily,
            fontSize: ed.typography.eyebrow.fontSize,
            letterSpacing: ed.typography.eyebrow.letterSpacing,
            color: ed.colors.ink3,
            textTransform: 'uppercase',
          }}
        >
          Step 1 of 5
        </Text>
        <View style={{ flex: wide ? 0 : 1, justifyContent: 'center', gap: 18, marginTop: wide ? 72 : 0 }}>
          <EditorialHeadline size="display">{`Are you *18* or older?`}</EditorialHeadline>
          <Text
            style={{
              fontFamily: ed.typography.bodyMd.fontFamily,
              fontSize: 15,
              lineHeight: 23,
              color: ed.colors.ink2,
              maxWidth: 360,
            }}
          >
            Helix is only for adults. We store the time of your acknowledgement for compliance — we
            never see your age itself.
          </Text>
        </View>

        <View style={{ gap: 14, marginTop: wide ? 72 : 0 }}>
          <EditorialButton fullWidth onPress={yes}>
            Yes, I am 18+
          </EditorialButton>
          <EditorialButton variant="secondary" fullWidth onPress={() => router.replace('/welcome')}>
            No, I am not
          </EditorialButton>
        </View>
      </View>
    </View>
  );
}
