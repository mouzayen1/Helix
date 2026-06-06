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
import * as AppleAuthentication from 'expo-apple-authentication';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
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
          <AppleProviderButton
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
          <GoogleProviderButton
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

const PROVIDER_BUTTON_HEIGHT = 48;
const PROVIDER_BUTTON_RADIUS = 0;

function AppleProviderButton({
  disabled,
  busy,
  onPress,
  style,
}: {
  disabled?: boolean;
  busy?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const ed = useEditorialTheme();

  if (Platform.OS === 'ios') {
    return (
      <View style={[{ height: PROVIDER_BUTTON_HEIGHT, opacity: disabled && !busy ? 0.4 : 1 }, style]}>
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={PROVIDER_BUTTON_RADIUS}
          onPress={onPress}
          style={{ width: '100%', height: PROVIDER_BUTTON_HEIGHT }}
        />
        {busy ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              inset: 0,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: ed.colors.ink1,
            }}
          >
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Sign in with Apple"
      accessibilityState={{ disabled, busy }}
      style={[
        {
          minHeight: PROVIDER_BUTTON_HEIGHT,
          paddingHorizontal: 16,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          backgroundColor: '#000000',
          borderRadius: PROVIDER_BUTTON_RADIUS,
          opacity: disabled && !busy ? 0.4 : 1,
        },
        style ?? {},
      ]}
    >
      {busy ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          <AppleLogo color="#FFFFFF" />
          <Text
            style={{
              marginLeft: 12,
              fontFamily: ed.typography.bodyStrong.fontFamily,
              fontSize: 15,
              lineHeight: 20,
              color: '#FFFFFF',
              fontWeight: '600',
            }}
          >
            Sign in with Apple
          </Text>
        </>
      )}
    </Pressable>
  );
}

function GoogleProviderButton({
  disabled,
  busy,
  onPress,
  style,
}: {
  disabled?: boolean;
  busy?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const ed = useEditorialTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Sign in with Google"
      accessibilityState={{ disabled, busy }}
      style={[
        {
          minHeight: PROVIDER_BUTTON_HEIGHT,
          paddingLeft: Platform.OS === 'ios' ? 16 : 12,
          paddingRight: Platform.OS === 'ios' ? 16 : 12,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#747775',
          borderRadius: PROVIDER_BUTTON_RADIUS,
          opacity: disabled && !busy ? 0.4 : 1,
        },
        style ?? {},
      ]}
    >
      {busy ? (
        <ActivityIndicator color="#1F1F1F" />
      ) : (
        <>
          <View style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
            <GoogleGLogo />
          </View>
          <View style={{ width: Platform.OS === 'ios' ? 12 : 10 }} />
          <Text
            style={{
              fontFamily: Platform.OS === 'web' ? 'Roboto, Arial, sans-serif' : ed.typography.bodyStrong.fontFamily,
              fontSize: 14,
              lineHeight: 20,
              color: '#1F1F1F',
              fontWeight: '500',
            }}
          >
            Sign in with Google
          </Text>
        </>
      )}
    </Pressable>
  );
}

function AppleLogo({ color }: { color: string }) {
  return (
    <Svg width={18} height={22} viewBox="0 0 18 22" fill="none">
      <Path
        fill={color}
        d="M14.8 11.5c0-2.5 2.1-3.7 2.2-3.8-1.2-1.7-3-2-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.6 1.3 10.1.9 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8 2.3-1.2 3.1-2.4c1-1.4 1.4-2.8 1.4-2.9-.1 0-3-1.1-3-4Zm-2.4-7.4c.7-.8 1.1-1.9 1-3.1-1 .1-2.1.6-2.8 1.4-.6.7-1.2 1.9-1 3 1.1.1 2.1-.5 2.8-1.3Z"
      />
    </Svg>
  );
}

function GoogleGLogo() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        fill="#4285F4"
        d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8c-.2 1.1-.8 2-1.8 2.6v2.1h2.8c1.6-1.5 2.8-3.7 2.8-6.3Z"
      />
      <Path
        fill="#34A853"
        d="M9 18c2.4 0 4.4-.8 5.9-2.2l-2.8-2.1c-.8.5-1.8.8-3 .8-2.3 0-4.2-1.5-4.9-3.6H1.3v2.2C2.7 16 5.6 18 9 18Z"
      />
      <Path
        fill="#FBBC05"
        d="M4.1 10.9c-.2-.5-.3-1.1-.3-1.7s.1-1.2.3-1.7V5.2H1.3C.5 6.4 0 7.7 0 9.2s.5 2.8 1.3 4l2.8-2.3Z"
      />
      <Path
        fill="#EA4335"
        d="M9 3.6c1.3 0 2.5.5 3.4 1.3L15 2.3C13.4.9 11.4 0 9 0 5.6 0 2.7 2 1.3 5.2l2.8 2.2C4.8 5.3 6.7 3.6 9 3.6Z"
      />
    </Svg>
  );
}
