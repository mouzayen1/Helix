// Reset password — landing screen for the Supabase password-reset email
// deep link (helix://reset-password#access_token=...&refresh_token=...).
//
// On native, `detectSessionInUrl` is disabled (web-only feature) so the
// Supabase client does NOT automatically pick up the tokens from the
// deep link URL. Without this screen establishing the session manually,
// `updateUser({ password })` fails with "Auth session missing" — the
// recovery token is in the URL hash but never reaches the client.
//
// Flow:
//   1. On mount, read the initial URL (cold-launch case) AND subscribe
//      to subsequent URL events (warm-launch case).
//   2. Parse `access_token` + `refresh_token` from the hash fragment.
//   3. Call `sb.auth.setSession({ access_token, refresh_token })` —
//      this primes the client with a short-lived recovery session.
//   4. Enable the form. Submission calls `sb.auth.updateUser({ password })`
//      against the recovery session.
//
// Failure modes:
//   - No tokens in URL → the link is malformed or expired; tell the
//     user to request a new reset email.
//   - setSession returns an error → recovery token is expired (Supabase
//     reset links are valid for 1 hour by default).

import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { useEditorialTheme } from '../../lib/design/theme';
import { updatePassword, validatePassword, EmailAuthError } from '../../lib/auth/email';
import { requireSupabase } from '../../lib/supabase';
import { haptic } from '../../lib/haptics';

type LinkState =
  | { status: 'checking' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

function extractRecoveryTokens(
  url: string,
): { accessToken: string; refreshToken: string } | null {
  // Supabase recovery links land as helix://reset-password#access_token=...&
  // refresh_token=...&type=recovery. Some email clients rewrite the hash
  // into a query string, so check both. We don't enforce `type=recovery`
  // here — Supabase already proofed the token by the time it got to us.
  const accessMatch = url.match(/[#?&]access_token=([^&]+)/);
  const refreshMatch = url.match(/[#?&]refresh_token=([^&]+)/);
  if (!accessMatch || !refreshMatch) return null;
  return {
    accessToken: decodeURIComponent(accessMatch[1]),
    refreshToken: decodeURIComponent(refreshMatch[1]),
  };
}

export default function ResetPasswordScreen() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [linkState, setLinkState] = useState<LinkState>({ status: 'checking' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    const establishFromUrl = async (url: string | null) => {
      if (!url || !mounted) return;
      // Only act on links that target this screen — the app receives
      // every deep link, including OAuth callbacks.
      if (!url.includes('reset-password')) return;
      const tokens = extractRecoveryTokens(url);
      if (!tokens) {
        if (mounted) {
          setLinkState({
            status: 'error',
            message:
              'This reset link is missing its tokens. Request a new one from the sign-in screen.',
          });
        }
        return;
      }
      try {
        const sb = requireSupabase();
        const { error } = await sb.auth.setSession({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
        });
        if (!mounted) return;
        if (error) {
          setLinkState({
            status: 'error',
            message:
              'This reset link has expired. Request a new one from the sign-in screen.',
          });
          return;
        }
        setLinkState({ status: 'ready' });
      } catch {
        if (mounted) {
          setLinkState({
            status: 'error',
            message: 'Could not start a recovery session. Please try again.',
          });
        }
      }
    };

    // Cold-launch path: app was closed when the user tapped the link.
    Linking.getInitialURL().then((url) => {
      if (!mounted) return;
      if (url && url.includes('reset-password')) {
        void establishFromUrl(url);
      } else {
        // The screen was navigated to directly (e.g. via dev menu) or
        // the user already has a live session — fall through and let
        // updateUser succeed against the existing session.
        setLinkState({ status: 'ready' });
      }
    });

    // Warm-launch path: app was running when the user tapped the link.
    const sub = Linking.addEventListener('url', ({ url }) => {
      setLinkState({ status: 'checking' });
      void establishFromUrl(url);
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const onSubmit = async () => {
    if (busy || linkState.status !== 'ready') return;
    const pe = validatePassword(password);
    if (pe) {
      setErr(pe);
      return;
    }
    if (password !== confirm) {
      setErr('Passwords do not match.');
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      await updatePassword(password);
      haptic.success();
      Alert.alert(
        'Password updated',
        'You can use your new password from now on.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)' as never) }],
      );
    } catch (e) {
      haptic.error();
      const msg =
        e instanceof EmailAuthError
          ? e.message
          : e instanceof Error && e.message
            ? e.message
            : 'Please try again.';
      Alert.alert('Could not update password', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: ed.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + 40,
          paddingHorizontal: 32,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <EyebrowLabel>Reset password</EyebrowLabel>
        <View style={{ marginTop: 12 }}>
          <EditorialHeadline size="title1">Set a *new password*.</EditorialHeadline>
        </View>

        {linkState.status === 'checking' ? (
          <View style={{ marginTop: 48, alignItems: 'center' }}>
            <ActivityIndicator color={ed.colors.brand} />
            <Text
              style={{
                marginTop: 16,
                fontFamily: ed.typography.labelSm.fontFamily,
                fontSize: ed.typography.labelSm.fontSize,
                letterSpacing: ed.typography.labelSm.letterSpacing,
                color: ed.colors.ink3,
                textTransform: 'uppercase',
              }}
            >
              Verifying reset link…
            </Text>
          </View>
        ) : null}

        {linkState.status === 'error' ? (
          <View style={{ marginTop: 40 }}>
            <Text
              style={{
                fontFamily: ed.fraunces('Fraunces_400Regular'),
                fontSize: 17,
                lineHeight: 25,
                color: ed.colors.ink2,
              }}
            >
              {linkState.message}
            </Text>
            <Pressable
              onPress={() => router.replace('/(auth)/forgot-password')}
              style={{ marginTop: 24, paddingVertical: 12 }}
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
                Request a new link →
              </Text>
            </Pressable>
          </View>
        ) : null}

        {linkState.status === 'ready' ? (
          <>
            <View style={{ marginTop: 40 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
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
                  New password
                </Text>
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={6}>
                  <Text
                    style={{
                      fontFamily: ed.typography.labelSm.fontFamily,
                      fontSize: ed.typography.labelSm.fontSize,
                      letterSpacing: ed.typography.labelSm.letterSpacing,
                      color: ed.colors.brand,
                      textTransform: 'uppercase',
                    }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </Pressable>
              </View>
              <TextInput
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (err) setErr(null);
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                autoCorrect={false}
                placeholder="At least 8 characters"
                placeholderTextColor={ed.colors.ink4}
                selectionColor={ed.colors.brand}
                style={{
                  fontFamily: ed.fraunces('Fraunces_400Regular'),
                  fontSize: 18,
                  lineHeight: 24,
                  color: ed.colors.ink1,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: err ? ed.colors.stateWarn : ed.colors.line,
                }}
              />
            </View>

            <View style={{ marginTop: 24 }}>
              <Text
                style={{
                  fontFamily: ed.typography.labelSm.fontFamily,
                  fontSize: ed.typography.labelSm.fontSize,
                  letterSpacing: ed.typography.labelSm.letterSpacing,
                  color: ed.colors.ink3,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Confirm password
              </Text>
              <TextInput
                value={confirm}
                onChangeText={(v) => {
                  setConfirm(v);
                  if (err) setErr(null);
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={ed.colors.ink4}
                selectionColor={ed.colors.brand}
                style={{
                  fontFamily: ed.fraunces('Fraunces_400Regular'),
                  fontSize: 18,
                  lineHeight: 24,
                  color: ed.colors.ink1,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: err ? ed.colors.stateWarn : ed.colors.line,
                }}
              />
            </View>

            {err ? (
              <Text
                style={{
                  marginTop: 12,
                  fontFamily: ed.typography.bodySm.fontFamily,
                  fontSize: 13,
                  color: ed.colors.stateWarn,
                }}
              >
                {err}
              </Text>
            ) : null}

            <View style={{ marginTop: 40 }}>
              <EditorialButton fullWidth onPress={onSubmit} disabled={busy}>
                {busy ? 'Updating…' : 'Update password'}
              </EditorialButton>
            </View>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
