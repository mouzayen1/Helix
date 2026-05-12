// Reset password — lands here from the Supabase password-reset email
// deep-link (helix://auth/reset-password). By the time this screen
// renders, Supabase has already exchanged the recovery token for a
// session, so the user is signed in. The form just calls
// supabase.auth.updateUser({ password }).
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { useEditorialTheme } from '../../lib/design/theme';
import { updatePassword, validatePassword, EmailAuthError } from '../../lib/auth/email';
import { haptic } from '../../lib/haptics';

export default function ResetPasswordScreen() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (busy) return;
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
      const msg = e instanceof EmailAuthError ? e.message : 'Please try again.';
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

        <View style={{ marginTop: 40 }}>
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
