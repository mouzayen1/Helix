// Delete account — multi-step destructive flow.
//
// Required by Apple App Store Guideline 5.1.1(v) and Play Store policy.
// Two screens, side-by-side:
//
//   Step 1 — warning + bullet list of consequences, "KEEP MY ACCOUNT" /
//            "Continue to delete →"
//   Step 2 — type "DELETE" to confirm, "CANCEL" / "Delete my account"
//
// On confirm:
//   1. Call the delete_my_account RPC (server marks profiles.deleted_at).
//   2. Sign out of Supabase (clears the session locally).
//   3. Wipe local SQLite (deleteAllUserData()).
//   4. Replace navigation to /(auth)/sign-up.
//
// Permanent purge of the auth.users row happens 30 days later via a
// scheduled job; until then the row is soft-deleted and the user can
// theoretically be restored by support. Not exposed in v1.0.
//
// Pre-auth fallback: when isAuthConfigured() is false this screen
// still does a local wipe — the only path that exists in legacy
// local-only builds. The server RPC + sign-out steps short-circuit.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { useEditorialTheme } from '../../lib/design/theme';
import { deleteAllUserData } from '../../lib/db';
import { useProfile } from '../../lib/profile-context';
import { isAuthConfigured, supabase } from '../../lib/supabase';
import { signOut } from '../../lib/auth/session';
import { signOutGoogle } from '../../lib/auth/google';
import { haptic } from '../../lib/haptics';

const CONFIRM_PHRASE = 'DELETE';

type Step = 'warning' | 'confirm';

export default function DeleteAccountScreen() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refresh } = useProfile();
  const [step, setStep] = useState<Step>('warning');
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);

  const authMode = isAuthConfigured();
  const canDelete = phrase === CONFIRM_PHRASE;

  const runDelete = async () => {
    if (!canDelete || busy) return;
    setBusy(true);
    try {
      // 1. Server-side soft delete (auth mode only). Best-effort: even
      //    if the RPC fails, we still wipe local data and sign out so
      //    the user isn't trapped in a half-deleted state. The cron
      //    job will reconcile pending records later.
      if (authMode) {
        const sb = supabase();
        if (sb) {
          try {
            await sb.rpc('delete_my_account');
          } catch (err) {
            console.warn('delete_my_account RPC failed:', err);
          }
        }
      }

      // 2. Local SQLite wipe — runs in both modes.
      await deleteAllUserData();
      await refresh();

      // 3. Sign out of native sessions + Supabase. Sign-out clears the
      //    session in AsyncStorage; the auth listener flips the gate
      //    in app/_layout.tsx and routes to /(auth)/sign-up on the
      //    next render.
      if (authMode) {
        await signOutGoogle();
        await signOut();
      }

      haptic.success();
      // Belt-and-suspenders navigation: when auth is configured the
      // gate will route us anyway; when it's not, we need to land
      // somewhere sensible.
      router.replace(authMode ? '/(auth)/sign-up' : '/welcome');
    } catch (err) {
      setBusy(false);
      haptic.error();
      Alert.alert(
        'Could not delete account',
        err instanceof Error ? err.message : 'Please try again.',
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: ed.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 64 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            paddingTop: insets.top + 12,
            paddingBottom: 12,
            paddingHorizontal: 24,
          }}
        >
          <Pressable
            onPress={() => (step === 'warning' ? router.back() : setStep('warning'))}
            hitSlop={10}
          >
            <Text
              style={{
                fontFamily: ed.fraunces('Fraunces_300Light'),
                fontSize: 26,
                color: ed.colors.ink2,
                lineHeight: 26,
              }}
            >
              ←
            </Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 24 }}>
          <Text
            style={{
              fontFamily: ed.typography.eyebrow.fontFamily,
              fontSize: ed.typography.eyebrow.fontSize,
              letterSpacing: ed.typography.eyebrow.letterSpacing,
              color: ed.colors.stateWarn,
              textTransform: 'uppercase',
              marginBottom: 14,
            }}
          >
            Destructive
          </Text>
          <EditorialHeadline size="title1" color={ed.colors.stateWarn}>
            {authMode ? `Delete your *account*?` : `Delete *everything*?`}
          </EditorialHeadline>
        </View>

        {step === 'warning' ? (
          <WarningStep
            authMode={authMode}
            onContinue={() => setStep('confirm')}
            onCancel={() => router.back()}
          />
        ) : (
          <ConfirmStep
            authMode={authMode}
            phrase={phrase}
            onPhraseChange={setPhrase}
            canDelete={canDelete}
            busy={busy}
            onConfirm={runDelete}
            onCancel={() => setStep('warning')}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function WarningStep({
  authMode,
  onContinue,
  onCancel,
}: {
  authMode: boolean;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const ed = useEditorialTheme();
  const bullets = authMode
    ? [
        'All your cloud-stored data will be permanently deleted within 30 days.',
        'Your local data on this device will be deleted now.',
        'Your founder status (if applicable) is lost permanently.',
        'You will need to create a new account to use Helix again.',
      ]
    : [
        'Every dose, vial, cycle, stack, journal entry, metric, and preference on this device.',
        'This cannot be undone.',
      ];
  return (
    <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
      <View
        style={{
          paddingVertical: 18,
          paddingHorizontal: 14,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: ed.colors.stateWarn,
          gap: 12,
        }}
      >
        {bullets.map((b) => (
          <Text
            key={b}
            style={{
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 15,
              lineHeight: 23,
              color: ed.colors.ink1,
            }}
          >
            • {b}
          </Text>
        ))}
      </View>

      {authMode ? (
        <Text
          style={{
            marginTop: 16,
            fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
            fontSize: 15,
            lineHeight: 23,
            color: ed.colors.ink2,
          }}
        >
          If you just want to stop using Helix, sign out instead — your
          data stays safe.
        </Text>
      ) : null}

      <View style={{ marginTop: 28, gap: 12 }}>
        <EditorialButton fullWidth onPress={onCancel}>
          {authMode ? 'Keep my account' : 'Keep my data'}
        </EditorialButton>
        <Pressable
          onPress={onContinue}
          accessibilityRole="button"
          style={{ paddingVertical: 16, alignItems: 'center' }}
        >
          <Text
            style={{
              fontFamily: ed.typography.label.fontFamily,
              fontSize: 13,
              letterSpacing: 1.8,
              color: ed.colors.stateWarn,
              textTransform: 'uppercase',
            }}
          >
            Continue to delete →
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ConfirmStep({
  authMode,
  phrase,
  onPhraseChange,
  canDelete,
  busy,
  onConfirm,
  onCancel,
}: {
  authMode: boolean;
  phrase: string;
  onPhraseChange: (s: string) => void;
  canDelete: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ed = useEditorialTheme();
  return (
    <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
      <EyebrowLabel>Confirm</EyebrowLabel>
      <Text
        style={{
          marginTop: 14,
          fontFamily: ed.fraunces('Fraunces_400Regular'),
          fontSize: 17,
          lineHeight: 26,
          color: ed.colors.ink1,
        }}
      >
        Type{' '}
        <Text style={{ fontFamily: ed.typography.dataMd.fontFamily }}>
          {CONFIRM_PHRASE}
        </Text>{' '}
        to confirm. This step is here so you don&apos;t do it accidentally.
      </Text>

      <View style={{ marginTop: 24 }}>
        <TextInput
          value={phrase}
          onChangeText={onPhraseChange}
          placeholder={CONFIRM_PHRASE}
          placeholderTextColor={ed.colors.ink4}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          selectionColor={ed.colors.stateWarn}
          style={{
            paddingVertical: 14,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: canDelete ? ed.colors.stateWarn : ed.colors.lineStrong,
            fontFamily: ed.typography.dataMd.fontFamily,
            fontSize: 20,
            letterSpacing: 2,
            color: ed.colors.ink1,
            textAlign: 'center',
          }}
        />
      </View>

      <View style={{ marginTop: 28, gap: 12 }}>
        <EditorialButton variant="secondary" fullWidth onPress={onCancel} disabled={busy}>
          Cancel
        </EditorialButton>
        <Pressable
          onPress={onConfirm}
          disabled={!canDelete || busy}
          accessibilityRole="button"
          style={{
            paddingVertical: 18,
            backgroundColor: canDelete && !busy ? ed.colors.stateWarn : ed.colors.lineStrong,
            opacity: !canDelete || busy ? 0.5 : 1,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: ed.typography.label.fontFamily,
              fontSize: 13,
              letterSpacing: 1.8,
              color: ed.colors.bg,
              textTransform: 'uppercase',
            }}
          >
            {busy ? 'Deleting…' : authMode ? 'Delete my account' : 'Delete all data'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
