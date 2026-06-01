// Sign-up screen — first thing the user sees on a fresh install.
//
// Three buttons in priority order: Apple, Google, Email. Apple must be on
// top per App Store policy when any social provider is offered. The
// Apple button is hidden entirely on Android (where Sign in with Apple
// isn't available); on iOS it's always shown but the underlying flow
// guards `isAppleSignInAvailable()` for the rare device without an
// Apple ID configured.
//
// No back button. No "skip." No anonymous mode. The app does not
// progress past this screen until the user signs up — which is enforced
// by the auth gate in app/_layout.tsx (slice A3).
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { useWideWeb } from '../../components/editorial/WebColumn';
import { useEditorialTheme } from '../../lib/design/theme';
import { isAppleSignInAvailable, signInWithApple, AppleSignInError } from '../../lib/auth/apple';
import { signInWithGoogle, GoogleSignInError } from '../../lib/auth/google';
import { grantFounderIfEligible, getFounderCounter } from '../../lib/auth/founder';
import { nextRouteAfterSignIn } from '../../lib/auth/terms-status';
import { haptic } from '../../lib/haptics';

type Provider = 'apple' | 'google' | 'email';

export default function SignUpScreen() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Wide-viewport (desktop/laptop web) layout. Gated on width, not just
  // Platform.OS === 'web', so mobile-web and the PWA keep the phone layout
  // below — the bottom-anchored design only looks broken once the viewport
  // is tall and wide enough to open a void between headline and buttons.
  const wide = useWideWeb();
  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [spotsLeft, setSpotsLeft] = useState<number | null>(null);

  useEffect(() => {
    // Apple button visibility — iOS only, plus the device-availability check.
    isAppleSignInAvailable().then(setAppleAvailable);
    // Marketing surface: founder counter. Errors silently hide the chip.
    getFounderCounter().then((c) => setSpotsLeft(c?.spotsLeft ?? null));
  }, []);

  const onApple = useCallback(async () => {
    if (busyProvider) return;
    setBusyProvider('apple');
    try {
      const session = await signInWithApple();
      // Best-effort founder grant. Failure is non-fatal — the gate keeps
      // running, the celebration banner just won't fire this session.
      try {
        await grantFounderIfEligible(session.user.id);
      } catch {}
      haptic.success();
      // Returning users with a live terms acceptance skip accept-terms
      // and land straight on /(tabs); first-time sign-ups (or stale
      // terms_version) pass through accept-terms.
      const next = await nextRouteAfterSignIn(session.user.id);
      router.replace(next as never);
    } catch (err) {
      if (err instanceof AppleSignInError && err.code === 'CANCELED') {
        // Silent dismissal.
        return;
      }
      haptic.error();
      Alert.alert(
        'Sign-in failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setBusyProvider(null);
    }
  }, [busyProvider, router]);

  const onGoogle = useCallback(async () => {
    if (busyProvider) return;
    setBusyProvider('google');
    try {
      const session = await signInWithGoogle();
      try {
        await grantFounderIfEligible(session.user.id);
      } catch {}
      haptic.success();
      const next = await nextRouteAfterSignIn(session.user.id);
      router.replace(next as never);
    } catch (err) {
      if (err instanceof GoogleSignInError && err.code === 'CANCELED') {
        return;
      }
      haptic.error();
      Alert.alert(
        'Sign-in failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setBusyProvider(null);
    }
  }, [busyProvider, router]);

  const onEmail = useCallback(() => {
    router.push('/(auth)/email-sign-up');
  }, [router]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: ed.colors.bg }}
      contentContainerStyle={{
        paddingTop: wide ? 48 : insets.top + 80,
        paddingBottom: wide ? 48 : insets.bottom + 32,
        paddingHorizontal: wide ? 24 : 32,
        minHeight: '100%',
        // Wide web: center the constrained column both axes so it reads as
        // a card, not a top-left fragment with the buttons stranded at the
        // bottom of a tall window. Phone layout is untouched.
        ...(wide ? { alignItems: 'center', justifyContent: 'center' } : null),
      }}
    >
      {/* Content column. On phone it flexes to fill height so the button
          block below can anchor to the bottom; on wide web it's a natural-
          height, max-width centered column. */}
      <View style={wide ? { width: '100%', maxWidth: 440 } : { flex: 1, width: '100%' }}>
      {/* Marketing surface — "X founder spots left". Hidden if the
          counter read failed or there are no spots remaining; once the
          last founder claims, the message switches. */}
      {spotsLeft !== null ? (
        <Text
          style={{
            fontFamily: ed.typography.eyebrow.fontFamily,
            fontSize: ed.typography.eyebrow.fontSize,
            letterSpacing: ed.typography.eyebrow.letterSpacing,
            color: spotsLeft > 0 ? ed.colors.brand : ed.colors.ink3,
            textTransform: 'uppercase',
            marginBottom: 32,
          }}
        >
          {spotsLeft > 0
            ? `Only ${spotsLeft} founder ${spotsLeft === 1 ? 'spot' : 'spots'} left`
            : 'Founder spots claimed · welcome aboard'}
        </Text>
      ) : null}

      <EditorialHeadline size="title1">Welcome to *Helix*.</EditorialHeadline>

      <Text
        style={{
          marginTop: 16,
          fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
          fontSize: 18,
          lineHeight: 26,
          color: ed.colors.ink2,
        }}
      >
        Research tracking, designed for clarity.
      </Text>

      <View style={wide ? { marginTop: 48 } : { flex: 1, justifyContent: 'flex-end', marginTop: 80 }}>
        {/* Apple — top per App Store policy. iOS only; hidden on
            Android and on iOS devices without an Apple ID. */}
        {appleAvailable ? (
          <ProviderButton
            label="Sign in with Apple"
            variant="primary"
            disabled={!!busyProvider}
            busy={busyProvider === 'apple'}
            onPress={onApple}
          />
        ) : null}

        {/* Google — hidden on iOS for v1.0. The underlying iOS SDK
            includes a nonce claim in the id_token that we have no way
            to read or override (nonce control is gated behind the
            paid Universal Sign In tier of @react-native-google-signin),
            and Supabase's signInWithIdToken rejects with "Nonces
            mismatch." Apple Sign-In is the primary iOS social
            provider anyway (App Store policy requires it whenever
            other social logins are offered). Re-enable in v1.1 via
            expo-auth-session/providers/google or by patching the
            library. */}
        {Platform.OS !== 'ios' ? (
          <ProviderButton
            label="Sign in with Google"
            variant="secondary"
            disabled={!!busyProvider}
            busy={busyProvider === 'google'}
            onPress={onGoogle}
            style={{ marginTop: appleAvailable ? 12 : 0 }}
          />
        ) : null}

        <Pressable
          onPress={onEmail}
          disabled={!!busyProvider}
          accessibilityRole="button"
          accessibilityLabel="Continue with email"
          style={{ marginTop: 24, paddingVertical: 12, alignItems: 'center' }}
        >
          <Text
            style={{
              fontFamily: ed.typography.label.fontFamily,
              fontSize: ed.typography.label.fontSize,
              letterSpacing: ed.typography.label.letterSpacing,
              color: ed.colors.ink2,
              textTransform: 'uppercase',
            }}
          >
            Continue with email
          </Text>
        </Pressable>

        {/* Tiny clarity line: the same buttons handle both new accounts
            and returning users. Apple's button text is fixed by their
            HIG ("Sign in with Apple"), so we keep the others consistent;
            the email button stays "Continue with email" since the
            downstream screen handles both create + sign-in. */}
        <Text
          style={{
            marginTop: 12,
            textAlign: 'center',
            fontFamily: ed.typography.labelSm.fontFamily,
            fontSize: ed.typography.labelSm.fontSize,
            letterSpacing: ed.typography.labelSm.letterSpacing,
            color: ed.colors.ink3,
            textTransform: 'uppercase',
          }}
        >
          New or returning · tap any option above
        </Text>

        <Text
          style={{
            marginTop: 32,
            textAlign: 'center',
            fontFamily: ed.typography.bodySm.fontFamily,
            fontSize: 13,
            lineHeight: 19,
            color: ed.colors.ink3,
          }}
        >
          By continuing, you confirm you&apos;re 18 or older and agree to our{' '}
          <Text
            style={{ color: ed.colors.brand, textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL('https://gethelixapp.org/terms').catch(() => {})}
          >
            Terms
          </Text>
          ,{' '}
          <Text
            style={{ color: ed.colors.brand, textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL('https://gethelixapp.org/privacy').catch(() => {})}
          >
            Privacy Policy
          </Text>
          , and Research Disclaimer.
        </Text>

        {Platform.OS === 'android' && !appleAvailable ? (
          <Text
            style={{
              marginTop: 16,
              textAlign: 'center',
              fontFamily: ed.typography.labelSm.fontFamily,
              fontSize: ed.typography.labelSm.fontSize,
              letterSpacing: ed.typography.labelSm.letterSpacing,
              color: ed.colors.ink3,
              textTransform: 'uppercase',
            }}
          >
            Sign in with Apple · iOS only
          </Text>
        ) : null}
      </View>
      </View>
    </ScrollView>
  );
}

function ProviderButton({
  label,
  variant,
  disabled,
  busy,
  onPress,
  style,
}: {
  label: string;
  variant: 'primary' | 'secondary';
  disabled?: boolean;
  busy?: boolean;
  onPress: () => void;
  style?: object;
}) {
  const ed = useEditorialTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      style={[
        {
          paddingVertical: 18,
          paddingHorizontal: 24,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: primary ? ed.colors.ink1 : 'transparent',
          borderWidth: primary ? 0 : 1,
          borderColor: ed.colors.lineStrong,
          opacity: disabled && !busy ? 0.4 : 1,
        },
        style ?? {},
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? ed.colors.bg : ed.colors.ink2} />
      ) : (
        <Text
          style={{
            fontFamily: ed.typography.label.fontFamily,
            fontSize: 13,
            letterSpacing: 1.8,
            color: primary ? ed.colors.bg : ed.colors.ink2,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
