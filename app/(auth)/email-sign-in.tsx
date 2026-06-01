// Email sign-in. Mirror of the sign-up form minus password rules + the
// "create account" CTA. Reached via the sign-up screen's secondary
// "Already have an account?" link.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { WebColumn } from '../../components/editorial/WebColumn';
import { useEditorialTheme } from '../../lib/design/theme';
import { signInWithEmail, validateEmail, EmailAuthError } from '../../lib/auth/email';
import { nextRouteAfterSignIn } from '../../lib/auth/terms-status';
import { haptic } from '../../lib/haptics';

export default function EmailSignInScreen() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (busy) return;
    const ee = validateEmail(email);
    setEmailErr(ee);
    if (ee) return;
    if (!password) {
      Alert.alert('Enter your password.');
      return;
    }
    setBusy(true);
    try {
      const session = await signInWithEmail(email, password);
      haptic.success();
      // Returning users with a live terms acceptance skip accept-terms.
      const next = await nextRouteAfterSignIn(session.user.id);
      router.replace(next as never);
    } catch (err) {
      haptic.error();
      const msg =
        err instanceof EmailAuthError
          ? err.message
          : err instanceof Error && err.message
            ? err.message
            : 'Please try again.';
      Alert.alert('Sign-in failed', msg);
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
        <EyebrowLabel>Welcome back</EyebrowLabel>
        <View style={{ marginTop: 12 }}>
          <EditorialHeadline size="title1">Sign in *to Helix*.</EditorialHeadline>
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
            style={{
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 18,
              lineHeight: 24,
              color: ed.colors.ink1,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: emailErr ? ed.colors.stateWarn : ed.colors.line,
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
            Password
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
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
              borderBottomColor: ed.colors.line,
            }}
          />
        </View>

        <Pressable
          onPress={() => router.push('/(auth)/forgot-password')}
          style={{ marginTop: 16, alignSelf: 'flex-end' }}
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
            Forgot password?
          </Text>
        </Pressable>

        <View style={{ marginTop: 40 }}>
          <EditorialButton fullWidth onPress={onSubmit} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </EditorialButton>
        </View>
        </WebColumn>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
