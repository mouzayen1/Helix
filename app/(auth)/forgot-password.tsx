// Forgot password — sends a Supabase reset email. The link in the
// email deep-links back to /(auth)/reset-password via the helix://
// scheme registered in app.json.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { useEditorialTheme } from '../../lib/design/theme';
import { sendPasswordReset, validateEmail, EmailAuthError } from '../../lib/auth/email';

export default function ForgotPasswordScreen() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (busy) return;
    const ee = validateEmail(email);
    setEmailErr(ee);
    if (ee) return;
    setBusy(true);
    try {
      await sendPasswordReset(email);
      Alert.alert(
        'Check your email',
        "If an account exists for that address, we've sent a password reset link.",
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      const msg = err instanceof EmailAuthError ? err.message : 'Please try again.';
      Alert.alert('Could not send reset email', msg);
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
        <EyebrowLabel>Forgot password</EyebrowLabel>
        <View style={{ marginTop: 12 }}>
          <EditorialHeadline size="title1">We&apos;ll *send a link*.</EditorialHeadline>
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
          Enter the email you signed up with. We&apos;ll email you a link
          to reset your password.
        </Text>

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

        <View style={{ marginTop: 40 }}>
          <EditorialButton fullWidth onPress={onSubmit} disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </EditorialButton>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
