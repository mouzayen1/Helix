// Choose path — editorial rebuild. Two stacked options framed by
// hairlines instead of fills; brass eyebrow on the recommended one.
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { useEditorialTheme } from '../../lib/design/theme';
import { useProfile } from '../../lib/profile-context';

export default function ChoosePath() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, update } = useProfile();

  const useLocally = async () => {
    if (
      !profile?.age_gate_accepted_at ||
      !profile.disclaimer_accepted_at ||
      !profile.terms_accepted_at
    ) {
      router.replace('/welcome');
      return;
    }
    await update({ onboarding_done: 1 });
    router.replace('/(tabs)');
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
        Step 5 of 5
      </Text>
      <View style={{ marginTop: 18 }}>
        <EditorialHeadline size="display">{`How do you want to *use* Helix?`}</EditorialHeadline>
      </View>

      <View style={{ flex: 1, gap: 18, paddingTop: 36 }}>
        <Pressable
          onPress={useLocally}
          accessibilityRole="button"
          style={{
            borderTopWidth: 2,
            borderBottomWidth: 1,
            borderTopColor: ed.colors.brand,
            borderBottomColor: ed.colors.brandLine,
            paddingVertical: 24,
            gap: 10,
          }}
        >
          <Text
            style={{
              fontFamily: ed.typography.label.fontFamily,
              fontSize: ed.typography.label.fontSize,
              letterSpacing: ed.typography.label.letterSpacing,
              color: ed.colors.brand,
              textTransform: 'uppercase',
            }}
          >
            Recommended
          </Text>
          <Text
            style={{
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 26,
              letterSpacing: -0.5,
              color: ed.colors.ink1,
            }}
          >
            Use Helix locally
          </Text>
          <Text
            style={{
              fontFamily: ed.typography.bodyMd.fontFamily,
              fontSize: 15,
              lineHeight: 23,
              color: ed.colors.ink2,
            }}
          >
            Your data stays on this device. No sign-in required. Create an account later to sync
            across devices.
          </Text>
        </Pressable>

        <View
          style={{
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: ed.colors.line,
            paddingVertical: 24,
            gap: 10,
            opacity: 0.55,
          }}
        >
          <Text
            style={{
              fontFamily: ed.typography.label.fontFamily,
              fontSize: ed.typography.label.fontSize,
              letterSpacing: ed.typography.label.letterSpacing,
              color: ed.colors.ink3,
              textTransform: 'uppercase',
            }}
          >
            Coming soon
          </Text>
          <Text
            style={{
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 26,
              letterSpacing: -0.5,
              color: ed.colors.ink2,
            }}
          >
            Create an account
          </Text>
          <Text
            style={{
              fontFamily: ed.typography.bodyMd.fontFamily,
              fontSize: 15,
              lineHeight: 23,
              color: ed.colors.ink3,
            }}
          >
            Sync across iOS, Android, and web. Export. Backup. Available in a future update.
          </Text>
        </View>
      </View>

      <Text
        style={{
          fontFamily: ed.typography.labelSm.fontFamily,
          fontSize: ed.typography.labelSm.fontSize,
          letterSpacing: ed.typography.labelSm.letterSpacing,
          color: ed.colors.ink3,
          textTransform: 'uppercase',
          textAlign: 'center',
        }}
      >
        Change your mind anytime in Settings.
      </Text>
    </View>
  );
}
