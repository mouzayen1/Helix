// Age gate — spec v2.0 onboarding step 1. Hard compliance checkpoint.
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '../../lib/profile-context';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

export default function AgeGate() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { update } = useProfile();

  const yes = async () => {
    await update({ age_gate_accepted_at: new Date().toISOString() });
    router.push('/(onboarding)/acknowledge');
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
        STEP 1 OF 4
      </Text>

      <View style={{ flex: 1, justifyContent: 'center', gap: space.lg }}>
        <Text
          style={{
            fontSize: 34,
            lineHeight: 40,
            fontFamily: font.sansBold,
            color: t.ink,
            letterSpacing: -1,
          }}
        >
          Are you 18{'\n'}or older?
        </Text>
        <Text style={{ color: t.ink2, fontSize: 15, lineHeight: 22 }}>
          Helix is only for adults. We store the time of your acknowledgement for
          compliance — we never see your age itself.
        </Text>
      </View>

      <View style={{ gap: space.md }}>
        <Pressable
          onPress={yes}
          style={{
            backgroundColor: t.ink,
            padding: space.lg,
            borderRadius: radius.lg,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: t.bg, fontSize: 16, fontFamily: font.sansSemi }}>
            Yes, I am 18+
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace('/welcome')}
          style={{
            padding: space.lg,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: t.ink3, fontSize: 14, fontFamily: font.sansMed }}>
            No, I am not
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
