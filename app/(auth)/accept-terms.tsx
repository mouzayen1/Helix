// One-time acceptance screen after first sign-up. Three explicit toggles:
//   1. 18+ confirmation
//   2. Terms of Service
//   3. Privacy Policy + Research Disclaimer
//
// None can be pre-checked (legal requirement in most jurisdictions).
// "Cancel — sign me out" exits to /(auth)/sign-up after a Supabase
// signOut, leaving the partially-created auth.users row intact (they
// can re-sign-in later, the trigger creates the profile, this screen
// re-appears until they accept).
//
// Acceptances are persisted to the user's profiles row via the
// Supabase JS client (RLS scopes the update to auth.uid()).
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { useEditorialTheme } from '../../lib/design/theme';
import { signOut } from '../../lib/auth/session';
import { requireSupabase } from '../../lib/supabase';
import { TERMS_VERSION } from '../../lib/disclaimers';
import { haptic } from '../../lib/haptics';
import { grantFounderIfEligible } from '../../lib/auth/founder';
import { markTermsAccepted } from '../../lib/auth/terms-status';
import { useProfile } from '../../lib/profile-context';

export default function AcceptTermsScreen() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { update: updateLocalProfile } = useProfile();
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [saving, setSaving] = useState(false);

  const canContinue = age && terms && privacy;

  const onContinue = async () => {
    if (!canContinue || saving) return;
    setSaving(true);
    try {
      const sb = requireSupabase();
      const now = new Date().toISOString();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) throw new Error('No active user. Try signing in again.');
      const { error } = await sb
        .from('profiles')
        .update({
          age_confirmed_at: now,
          terms_accepted_at: now,
          terms_version: TERMS_VERSION,
          privacy_accepted_at: now,
          disclaimer_accepted_at: now,
        })
        .eq('user_id', user.id);
      if (error) throw error;

      // Mirror to local profile so legacy onboarding gate is satisfied
      // even on fallback. Belt and suspenders — the root gate already
      // skips legacy onboarding in auth mode, but stamping locally
      // prevents any edge case (e.g., user signs out then signs back
      // in pre-auth) from re-routing through welcome.
      await updateLocalProfile({
        age_gate_accepted_at: now,
        terms_accepted_at: now,
        terms_version: TERMS_VERSION,
        disclaimer_accepted_at: now,
        onboarding_done: 1,
      });

      // Founder grant — called here as a fallback in case the
      // post-signup invocation failed silently. Idempotent server-side:
      // returns the existing number for already-founder users.
      try {
        await grantFounderIfEligible(user.id);
      } catch {
        // Non-fatal — celebration banner just won't fire if this fails.
      }

      // Tell the root gate the user has accepted — without this, the
      // gate's termsState is still 'pending' from its initial fetch
      // and would bounce the router.replace below straight back to
      // /(auth)/accept-terms.
      markTermsAccepted(user.id);

      haptic.success();
      router.replace('/(tabs)' as never);
    } catch (err) {
      haptic.error();
      Alert.alert(
        'Could not save',
        err instanceof Error ? err.message : 'Please try again.',
      );
      setSaving(false);
    }
  };

  const onCancel = () => {
    Alert.alert(
      'Sign out?',
      'You can come back anytime and finish creating your account.',
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/sign-up');
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: ed.colors.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 40,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 32,
      }}
    >
      <EyebrowLabel>One more step</EyebrowLabel>
      <View style={{ marginTop: 16 }}>
        <EditorialHeadline size="title1">Confirm *and accept*.</EditorialHeadline>
      </View>

      <Text
        style={{
          marginTop: 16,
          fontFamily: ed.fraunces('Fraunces_400Regular'),
          fontSize: 17,
          lineHeight: 25,
          color: ed.colors.ink2,
        }}
      >
        Helix is research and education only. Confirming below acknowledges
        you understand we don&apos;t provide medical advice.
      </Text>

      <View style={{ marginTop: 40, gap: 24 }}>
        <ToggleRow
          checked={age}
          onToggle={() => setAge((v) => !v)}
          label="I confirm I am 18 years of age or older."
        />
        <ToggleRow
          checked={terms}
          onToggle={() => setTerms((v) => !v)}
          label="I accept the Helix Terms of Service."
          link={{ label: 'Read Terms', url: 'https://gethelixapp.org/terms' }}
        />
        <ToggleRow
          checked={privacy}
          onToggle={() => setPrivacy((v) => !v)}
          label="I accept the Privacy Policy and Research Disclaimer."
          link={{ label: 'Read Privacy & Disclaimer', url: 'https://gethelixapp.org/privacy' }}
        />
      </View>

      <View style={{ marginTop: 56 }}>
        <EditorialButton
          fullWidth
          disabled={!canContinue || saving}
          onPress={onContinue}
        >
          {saving ? 'Saving…' : 'Continue'}
        </EditorialButton>
      </View>

      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        style={{ marginTop: 24, paddingVertical: 12, alignItems: 'center' }}
      >
        <Text
          style={{
            fontFamily: ed.typography.labelSm.fontFamily,
            fontSize: ed.typography.labelSm.fontSize,
            letterSpacing: ed.typography.labelSm.letterSpacing,
            color: ed.colors.ink3,
            textTransform: 'uppercase',
          }}
        >
          Cancel — sign me out
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function ToggleRow({
  checked,
  onToggle,
  label,
  link,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  link?: { label: string; url: string };
}) {
  const ed = useEditorialTheme();
  return (
    <View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderWidth: 1.5,
            borderColor: checked ? ed.colors.brand : ed.colors.lineStrong,
            backgroundColor: checked ? ed.colors.brand : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 2,
          }}
        >
          {checked ? (
            <Text style={{ color: ed.colors.bg, fontSize: 13, lineHeight: 13 }}>
              ✓
            </Text>
          ) : null}
        </View>
        <Text
          style={{
            flex: 1,
            fontFamily: ed.fraunces('Fraunces_400Regular'),
            fontSize: 16,
            lineHeight: 24,
            color: ed.colors.ink1,
          }}
        >
          {label}
        </Text>
      </Pressable>
      {link ? (
        <Pressable
          onPress={() => Linking.openURL(link.url).catch(() => {})}
          style={{ marginLeft: 36, marginTop: 4 }}
        >
          <Text
            style={{
              fontFamily: ed.typography.labelSm.fontFamily,
              fontSize: ed.typography.labelSm.fontSize,
              letterSpacing: ed.typography.labelSm.letterSpacing,
              color: ed.colors.brand,
              textTransform: 'uppercase',
            }}
          >
            {link.label} →
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
