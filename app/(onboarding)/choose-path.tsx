// Choose path — spec v2.0 onboarding step 4.
// Phase 1 is local-only so the "Create account" option is shown disabled for now.
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '../../lib/profile-context';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

export default function ChoosePath() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { update } = useProfile();

  const useLocally = async () => {
    await update({ onboarding_done: 1 });
    router.replace('/(tabs)');
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
        STEP 5 OF 5
      </Text>

      <Text
        style={{
          marginTop: space.lg,
          fontSize: 34,
          lineHeight: 40,
          fontFamily: font.sansBold,
          color: t.ink,
          letterSpacing: -1,
        }}
      >
        How do you want{'\n'}to use Helix?
      </Text>

      <View style={{ flex: 1, gap: space.md, paddingTop: space['2xl'] }}>
        <Pressable
          onPress={useLocally}
          style={{
            borderRadius: radius.lg,
            borderWidth: 2,
            borderColor: t.accent,
            backgroundColor: t.accentSoft,
            padding: space.xl,
            gap: space.sm,
          }}
        >
          <Text
            style={{
              color: t.accentInk,
              fontSize: 11,
              fontFamily: font.sansSemi,
              letterSpacing: 1.1,
            }}
          >
            RECOMMENDED
          </Text>
          <Text style={{ color: t.ink, fontSize: 20, fontFamily: font.sansBold }}>
            Use Helix locally
          </Text>
          <Text style={{ color: t.ink2, fontSize: 14, lineHeight: 20 }}>
            Your data stays on this device. No sign-in required. You can create an
            account later to sync across devices.
          </Text>
        </Pressable>

        <View
          style={{
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: t.line,
            padding: space.xl,
            gap: space.sm,
            opacity: 0.6,
          }}
        >
          <Text
            style={{
              color: t.ink3,
              fontSize: 11,
              fontFamily: font.sansSemi,
              letterSpacing: 1.1,
            }}
          >
            COMING SOON
          </Text>
          <Text style={{ color: t.ink, fontSize: 20, fontFamily: font.sansBold }}>
            Create an account
          </Text>
          <Text style={{ color: t.ink2, fontSize: 14, lineHeight: 20 }}>
            Sync across iOS, Android, and web. Export. Backup. Available in a
            future update.
          </Text>
        </View>
      </View>

      <Text
        style={{
          color: t.ink3,
          fontSize: 12,
          textAlign: 'center',
          fontFamily: font.sansMed,
          marginBottom: space.sm,
        }}
      >
        You can change your mind anytime from Settings.
      </Text>
    </View>
  );
}
