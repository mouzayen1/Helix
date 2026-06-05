// Email sign-up form. Returns to /(auth)/accept-terms on success.
// If the email is already registered, the underlying flow silently
// retries as sign-in — see lib/auth/email.ts.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { WebColumn } from '../../components/editorial/WebColumn';
import { useEditorialTheme } from '../../lib/design/theme';
import { signUpWithEmail, validateEmail, validatePassword, EmailAuthError } from '../../lib/auth/email';
import { grantFounderIfEligible } from '../../lib/auth/founder';
import { nextRouteAfterSignIn } from '../../lib/auth/terms-status';
import { haptic } from '../../lib/haptics';

export default function EmailSignUpScreen() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const webInputFocusReset =
    Platform.OS === 'web'
      ? ({ outlineWidth: 0 } as TextStyle)
      : null;

  const onSubmit = async () => {
    if (busy) return;
    const ee = validateEmail(email);
    const pe = validatePassword(password);
    setEmailErr(ee);
    setPasswordErr(pe);
    if (ee || pe) return;
    setBusy(true);
    try {
      const { session, requiresEmailVerification, wasReturningUser } = await signUpWithEmail(
        email,
        password,
      );
      if (requiresEmailVerification) {
        Alert.alert(
          'Check your email',
          'We sent a verification link. Tap it to finish signing up.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/sign-up') }],
        );
        return;
      }
      if (session) {
        try {
          await grantFounderIfEligible(session.user.id);
        } catch {}
        haptic.success();
        const next = await nextRouteAfterSignIn(session.user.id);
        // Returning-user case: the email was already registered and
        // the password matched, so we signed in instead of creating a
        // new account. Acknowledge that explicitly before navigating;
        // covers both "I forgot I had an account" and "I typed the
        // wrong email and it happened to match someone with the same
        // password" (the latter is vanishingly rare, but the same
        // notice still gives the user a recovery path).
        if (wasReturningUser) {
          Alert.alert(
            'Welcome back',
            "An account with this email already exists, and your password matched — so we signed you in instead of creating a new one. If this wasn't you, sign out from Settings.",
            [{ text: 'Continue', onPress: () => router.replace(next as never) }],
          );
        } else {
          router.replace(next as never);
        }
      }
    } catch (err) {
      haptic.error();
      // Existing-account + wrong-password case. The email is registered
      // but the supplied password didn't match, so neither sign-up nor
      // the silent sign-in retry could complete. Offer the two paths
      // the user actually has: sign in with the correct password, or
      // reset the password they don't remember.
      if (
        err instanceof EmailAuthError &&
        err.code === 'EMAIL_TAKEN_WRONG_PASSWORD'
      ) {
        Alert.alert(
          'This email already has an account',
          "An account with this email exists, but your password doesn't match. Sign in with the correct password, or tap \"Forgot password\" to reset it.",
          [
            {
              text: 'Sign in instead',
              onPress: () => router.replace('/(auth)/email-sign-in'),
            },
            {
              text: 'Forgot password',
              onPress: () => router.push('/(auth)/forgot-password'),
            },
          ],
        );
        return;
      }
      const msg =
        err instanceof EmailAuthError
          ? err.message
          : err instanceof Error && err.message
            ? err.message
            : 'Please try again.';
      Alert.alert('Sign-up failed', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: ed.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 24,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text
            style={{
              fontFamily: ed.fraunces('Fraunces_300Light'),
              fontSize: 26,
              color: ed.colors.ink2,
            }}
          >
            ×
          </Text>
        </Pressable>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 32, paddingBottom: insets.bottom + 24 }}
      >
        <WebColumn>
        <EyebrowLabel>Email</EyebrowLabel>
        <View style={{ marginTop: 12 }}>
          <EditorialHeadline size="title1">Create *your account*.</EditorialHeadline>
        </View>

        <View style={{ marginTop: 40 }}>
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
            Email address
          </Text>
          <TextInput
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (emailErr) setEmailErr(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            placeholder="you@example.com"
            placeholderTextColor={ed.colors.ink4}
            selectionColor={ed.colors.brand}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
            style={{
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 18,
              lineHeight: 24,
              color: ed.colors.ink1,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: emailErr
                ? ed.colors.stateWarn
                : focusedField === 'email'
                  ? ed.colors.brand
                  : ed.colors.line,
              ...webInputFocusReset,
            }}
          />
          {emailErr ? (
            <Text
              style={{
                marginTop: 6,
                fontFamily: ed.typography.bodySm.fontFamily,
                fontSize: 13,
                color: ed.colors.stateWarn,
              }}
            >
              {emailErr}
            </Text>
          ) : null}
        </View>

        <View style={{ marginTop: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text
              style={{
                fontFamily: ed.typography.labelSm.fontFamily,
                fontSize: ed.typography.labelSm.fontSize,
                letterSpacing: ed.typography.labelSm.letterSpacing,
                color: ed.colors.ink3,
                textTransform: 'uppercase',
              }}
            >
              Password
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
              if (passwordErr) setPasswordErr(null);
            }}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="new-password"
            autoCorrect={false}
            placeholder="At least 8 characters"
            placeholderTextColor={ed.colors.ink4}
            selectionColor={ed.colors.brand}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(null)}
            style={{
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 18,
              lineHeight: 24,
              color: ed.colors.ink1,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: passwordErr
                ? ed.colors.stateWarn
                : focusedField === 'password'
                  ? ed.colors.brand
                  : ed.colors.line,
              ...webInputFocusReset,
            }}
          />
          {passwordErr ? (
            <Text
              style={{
                marginTop: 6,
                fontFamily: ed.typography.bodySm.fontFamily,
                fontSize: 13,
                color: ed.colors.stateWarn,
              }}
            >
              {passwordErr}
            </Text>
          ) : (
            <Text
              style={{
                marginTop: 6,
                fontFamily: ed.typography.bodySm.fontFamily,
                fontSize: 13,
                color: ed.colors.ink3,
              }}
            >
              8+ characters with at least one letter and one number.
            </Text>
          )}
        </View>

        <View style={{ marginTop: 40 }}>
          <EditorialButton fullWidth onPress={onSubmit} disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </EditorialButton>
        </View>

        <View
          style={{
            marginTop: 24,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Text
            style={{
              fontFamily: ed.typography.bodySm.fontFamily,
              fontSize: 13,
              color: ed.colors.ink3,
            }}
          >
            Already have an account?
          </Text>
          <Pressable
            onPress={() => router.replace('/(auth)/email-sign-in')}
            hitSlop={6}
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
              Sign in
            </Text>
          </Pressable>
        </View>

        {busy ? (
          <ActivityIndicator
            color={ed.colors.brand}
            style={{ marginTop: 24, alignSelf: 'center' }}
          />
        ) : null}
        </WebColumn>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
