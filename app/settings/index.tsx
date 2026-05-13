// Settings — editorial rebuild. Hairline-divided rows in place of card
// fills; inline segmented controls for theme/units; switches retinted.
import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { HairlineRow } from '../../components/editorial/HairlineRow';
import { useEditorialTheme } from '../../lib/design/theme';
import { useProfile } from '../../lib/profile-context';
import { getAuthState, signOut, subscribeAuth, type AuthState } from '../../lib/auth/session';
import { signOutGoogle } from '../../lib/auth/google';
import { getMyFounderStatus } from '../../lib/auth/founder';
import { isAuthConfigured } from '../../lib/supabase';

export default function Settings() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, update } = useProfile();
  // Auth state mirrored from the session manager so the Account section
  // re-renders when the user signs out (or in, mid-session). When
  // isAuthConfigured() is false the section hides — pre-auth builds
  // continue to show the legacy settings layout unchanged.
  const [authState, setAuthState] = useState<AuthState>(getAuthState());
  useEffect(() => subscribeAuth(setAuthState), []);
  const session = authState.status === 'signed-in' ? authState.session : null;
  // Founder status mirror — re-fetched whenever the session changes.
  // Drives the "FOUNDER #N" badge below the display name. Errors are
  // non-fatal; badge simply doesn't render if the read fails.
  const [founderNumber, setFounderNumber] = useState<number | null>(null);
  useEffect(() => {
    if (!session) {
      setFounderNumber(null);
      return;
    }
    let cancelled = false;
    getMyFounderStatus().then((s) => {
      if (cancelled) return;
      setFounderNumber(s?.isFounder ? (s.founderNumber ?? null) : null);
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const setBiometricLock = async (enabled: boolean) => {
    if (!enabled) {
      await update({ biometric_lock: 0 });
      return;
    }
    const [hasHardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (!hasHardware) {
      Alert.alert(
        'Biometric unlock unavailable',
        "This device doesn't have biometric hardware. Helix can't lock to a fingerprint or Face ID here.",
      );
      return;
    }
    if (!enrolled) {
      Alert.alert(
        'No biometrics enrolled',
        'Set up a fingerprint or Face ID in your device settings first, then enable Helix lock.',
      );
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirm to require unlock for Helix',
      fallbackLabel: 'Use device passcode',
      disableDeviceFallback: false,
    });
    if (result.success) {
      await update({ biometric_lock: 1 });
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: ed.colors.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 64 }}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: 24,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
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
            color: ed.colors.ink3,
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          Settings
        </Text>
        <EditorialHeadline size="title1">{`Your *preferences*.`}</EditorialHeadline>
      </View>

      {/* Account — only when Supabase is configured. The native Apple /
          Google session is signed out alongside Supabase so the next
          picker re-prompts rather than auto-picking the last identity. */}
      {isAuthConfigured() && session ? (
        <View style={{ marginTop: 32, paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>Account</EyebrowLabel>
          <View style={{ paddingVertical: 18 }}>
            <Text
              style={{
                fontFamily: ed.fraunces('Fraunces_400Regular'),
                fontSize: 20,
                letterSpacing: -0.3,
                color: ed.colors.ink1,
              }}
            >
              {session.user.user_metadata?.display_name ||
                session.user.email?.split('@')[0] ||
                'Researcher'}
            </Text>
            {session.user.email ? (
              <Text
                style={{
                  marginTop: 4,
                  fontFamily: ed.typography.dataMd.fontFamily,
                  fontSize: ed.typography.dataMd.fontSize,
                  color: ed.colors.ink3,
                }}
              >
                {session.user.email}
              </Text>
            ) : null}
            {/* Permanent founder badge — brass mono caps, slot number,
                "lifetime free access" subtitle. Only renders for the
                first 100 signups. */}
            {founderNumber !== null ? (
              <View
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: ed.colors.brandLine,
                }}
              >
                <Text
                  style={{
                    fontFamily: ed.typography.label.fontFamily,
                    fontSize: ed.typography.label.fontSize,
                    letterSpacing: ed.typography.label.letterSpacing,
                    color: ed.colors.brand,
                    textTransform: 'uppercase',
                  }}
                >
                  ✦ Founder · #{founderNumber}
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    fontFamily: ed.typography.dataMd.fontFamily,
                    fontSize: ed.typography.dataMd.fontSize,
                    color: ed.colors.ink3,
                  }}
                >
                  Lifetime free access to all premium features
                </Text>
              </View>
            ) : null}
          </View>
          <HairlineRow />
          <NavRow
            label="Sign out"
            onPress={() => {
              Alert.alert(
                'Sign out of Helix?',
                'Your data stays safe on this device and in the cloud backup. You can sign back in anytime.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign out',
                    style: 'destructive',
                    onPress: async () => {
                      // Native Google session — best-effort; non-fatal on failure.
                      await signOutGoogle();
                      await signOut();
                      // The auth gate in app/_layout.tsx watches the
                      // session listener and replaces to /(auth)/sign-up
                      // automatically once the state flips to 'signed-out'.
                    },
                  },
                ],
              );
            }}
          />
          <HairlineRow />
          <NavRow
            label="Delete account"
            tone="warn"
            onPress={() => router.push('/settings/delete-account' as any)}
          />
          <HairlineRow strong />
        </View>
      ) : null}

      {/* Appearance */}
      <View style={{ marginTop: 32, paddingHorizontal: 24 }}>
        <EyebrowLabel withRule>Appearance</EyebrowLabel>
        <SettingRow label="Theme">
          <Segmented
            value={profile?.theme ?? 'system'}
            options={['system', 'light', 'dark']}
            onChange={(v) => update({ theme: v as any })}
          />
        </SettingRow>
        <HairlineRow strong />
      </View>

      {/* Units */}
      <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
        <EyebrowLabel withRule>Units</EyebrowLabel>
        <SettingRow label="Weight">
          <Segmented
            value={profile?.unit_weight ?? 'lb'}
            options={['lb', 'kg']}
            onChange={(v) => update({ unit_weight: v })}
          />
        </SettingRow>
        <HairlineRow />
        <SettingRow label="Syringe">
          <Segmented
            value={profile?.unit_volume ?? 'units'}
            options={['units', 'mL']}
            onChange={(v) => update({ unit_volume: v })}
          />
        </SettingRow>
        <HairlineRow />
        <SettingRow label="Dose display">
          <Segmented
            value={(profile?.dose_unit_pref ?? 'auto') as 'auto' | 'mcg' | 'mg'}
            options={['auto', 'mcg', 'mg']}
            onChange={(v) => update({ dose_unit_pref: v })}
          />
        </SettingRow>
        <HairlineRow strong />
      </View>

      {/* Privacy */}
      <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
        <EyebrowLabel withRule>Privacy</EyebrowLabel>
        <Pressable onPress={() => router.push('/settings/notifications' as any)}>
          <SettingRow label="Notifications">
            <Switch
              value={profile?.notifications_enabled === 1}
              onValueChange={(v) => update({ notifications_enabled: v ? 1 : 0 })}
              trackColor={{ false: ed.colors.lineStrong, true: ed.colors.brand }}
              thumbColor={ed.colors.bg}
            />
          </SettingRow>
        </Pressable>
        <HairlineRow />
        <SettingRow label="Require unlock to open Helix">
          <Switch
            value={profile?.biometric_lock === 1}
            onValueChange={(v) => void setBiometricLock(v)}
            trackColor={{ false: ed.colors.lineStrong, true: ed.colors.brand }}
            thumbColor={ed.colors.bg}
          />
        </SettingRow>
        <HairlineRow strong />
      </View>

      {/* Data */}
      <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
        <EyebrowLabel withRule>Data</EyebrowLabel>
        <NavRow label="Dose history" onPress={() => router.push('/dose-history' as any)} />
        <HairlineRow />
        <NavRow label="Export data" onPress={() => router.push('/settings/export')} />
        <HairlineRow />
        <NavRow label="About Helix" onPress={() => router.push('/settings/about')} />
        {/* Pre-auth legacy: "Delete all data" only exists when there's no
            Account section to host the same affordance. Once auth is
            configured, Account → Delete account replaces this row and
            covers both local wipe AND server-side soft delete. */}
        {!isAuthConfigured() ? (
          <>
            <HairlineRow />
            <NavRow
              label="Delete all data"
              tone="warn"
              onPress={() => router.push('/settings/delete-account')}
            />
          </>
        ) : null}
        <HairlineRow strong />
      </View>

      <Text
        style={{
          marginTop: 36,
          textAlign: 'center',
          fontFamily: ed.typography.labelSm.fontFamily,
          fontSize: ed.typography.labelSm.fontSize,
          letterSpacing: ed.typography.labelSm.letterSpacing,
          color: ed.colors.ink3,
          textTransform: 'uppercase',
        }}
      >
        Helix v{Constants.expoConfig?.version ?? '0.0.0'}
      </Text>
    </ScrollView>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  const ed = useEditorialTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        gap: 12,
      }}
    >
      <Text
        style={{
          flex: 1,
          fontFamily: ed.fraunces('Fraunces_400Regular'),
          fontSize: 17,
          letterSpacing: -0.2,
          color: ed.colors.ink1,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function NavRow({
  label,
  onPress,
  tone,
}: {
  label: string;
  onPress: () => void;
  tone?: 'warn';
}) {
  const ed = useEditorialTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        gap: 12,
      }}
    >
      <Text
        style={{
          flex: 1,
          fontFamily: ed.fraunces('Fraunces_400Regular'),
          fontSize: 17,
          letterSpacing: -0.2,
          color: tone === 'warn' ? ed.colors.stateWarn : ed.colors.ink1,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: ed.fraunces('Fraunces_300Light'),
          fontSize: 22,
          color: tone === 'warn' ? ed.colors.stateWarn : ed.colors.ink3,
        }}
      >
        →
      </Text>
    </Pressable>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
}) {
  const ed = useEditorialTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              backgroundColor: active ? ed.colors.ink1 : 'transparent',
              borderWidth: 1,
              borderColor: active ? ed.colors.ink1 : ed.colors.lineStrong,
            }}
          >
            <Text
              style={{
                fontFamily: ed.typography.labelSm.fontFamily,
                fontSize: ed.typography.labelSm.fontSize,
                letterSpacing: ed.typography.labelSm.letterSpacing,
                color: active ? ed.colors.bg : ed.colors.ink2,
                textTransform: 'uppercase',
              }}
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
