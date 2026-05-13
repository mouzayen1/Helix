import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { IBMPlexMono_400Regular, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';
import {
  Fraunces_300Light,
  Fraunces_300Light_Italic,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
  Fraunces_500Medium_Italic,
} from '@expo-google-fonts/fraunces';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { Stack, useRouter, useSegments } from 'expo-router';
import type * as LocalAuthenticationType from 'expo-local-authentication';

// Lazy + guarded require. The biometric-lock feature was added after the
// earliest production APKs were built, so the expo-local-authentication
// native module isn't bundled in older installs. A static import would
// crash at module load time on those installs. require()-with-try lets
// older APKs ship a no-op (lock silently disabled) while newer APKs get
// the full feature. Same pattern lib/notifications.ts uses for
// expo-notifications inside Expo Go.
let LocalAuthentication: typeof LocalAuthenticationType | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  LocalAuthentication = require('expo-local-authentication');
} catch {
  LocalAuthentication = null;
}
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { hasLegacyLocalData, initDatabase } from '../lib/db';
import { scheduleAllSafe } from '../lib/notifications';
import { ProfileProvider, useProfile } from '../lib/profile-context';
import { ThemeProvider, useTheme } from '../theme/ThemeContext';
import { font, radius, space } from '../theme/tokens';
import { hydrateSession, subscribeAuth, type AuthState } from '../lib/auth/session';
import { isAuthConfigured } from '../lib/supabase';
import { getMyFounderStatus, markFounderBannerSeen } from '../lib/auth/founder';
import { FounderCelebrationModal } from '../components/FounderCelebrationModal';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootGate() {
  const { t, isDark } = useTheme();
  const { profile, loaded } = useProfile();
  const router = useRouter();
  const segments = useSegments();
  // Auth-gate state. When isAuthConfigured() is false (env vars not
  // baked into the build), authReady fast-forwards to true with an
  // implicit "signed-out" state so the legacy onboarding flow can
  // still run. When env vars ARE set, hydrateSession() reads the
  // persisted Supabase session, then drives this state.
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' });
  const [authReady, setAuthReady] = useState(false);
  // Founder celebration banner — fires once per founder when their slot
  // is granted. Polled when the auth state transitions to signed-in;
  // dismissal stamps founder_banner_seen_at on the profile row so the
  // modal never re-fires (even across reinstalls).
  const [founderBanner, setFounderBanner] = useState<{
    visible: boolean;
    number: number;
    userId: string | null;
  }>({ visible: false, number: 0, userId: null });
  // Set once when sign-in completes — true iff legacy NULL-user_id rows
  // exist AND the user hasn't already chosen via the attribution prompt.
  // Gates the redirect to /(auth)/attribute-data.
  const [legacyDataPending, setLegacyDataPending] = useState(false);

  useEffect(() => {
    if (!isAuthConfigured()) {
      // No Supabase configured — legacy local-only flow. Don't enforce
      // an auth gate; downstream onboarding gate handles routing.
      setAuthState({ status: 'signed-out' });
      setAuthReady(true);
      return;
    }
    let cancelled = false;
    hydrateSession().then((state) => {
      if (!cancelled) {
        setAuthState(state);
        setAuthReady(true);
      }
    });
    const unsubscribe = subscribeAuth(setAuthState);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady || !loaded) return;
    const authConfigured = isAuthConfigured();
    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)' || segments[0] === 'welcome';

    // 1. Auth gate — only enforced when Supabase is configured. Routes
    //    signed-out users to the sign-up screen; once a user is
    //    signed-in + accepted terms, falls through to /(tabs) directly
    //    and the legacy onboarding flow (welcome → age-gate → terms →
    //    acknowledge → preferences → choose-path) is bypassed entirely.
    //    Account-required is the v1.0 product decision; the legacy
    //    onboarding only runs in legacy local-only builds where
    //    Supabase env vars aren't set.
    if (authConfigured) {
      if (authState.status === 'signed-out' && !inAuth) {
        router.replace('/(auth)/sign-up' as never);
        return;
      }
      if (authState.status !== 'signed-in') return;
      // Data attribution prompt — fires once per device when a signed-in
      // user has NULL-user_id legacy rows AND hasn't been stamped as
      // attributed yet.
      if (legacyDataPending && (segments as string[])[1] !== 'attribute-data') {
        router.replace('/(auth)/attribute-data' as never);
        return;
      }
      // Kick signed-in users out of any leftover legacy onboarding
      // routes (welcome / (onboarding)/*). Auth mode owns the legal
      // acceptance via accept-terms; legacy onboarding is unreachable.
      if (inOnboarding) {
        router.replace('/(tabs)');
        return;
      }
      // Stay inside (auth) until acceptance is recorded; let the
      // accept-terms screen replace to /(tabs) on success.
      return;
    }

    // 2. Legacy onboarding gate — runs ONLY when Supabase isn't
    //    configured (no env vars baked in). Real production builds
    //    never hit this path; preserved for dev builds without an
    //    auth backend.
    const fullyOnboarded =
      profile?.onboarding_done === 1 &&
      !!profile.age_gate_accepted_at &&
      !!profile.disclaimer_accepted_at &&
      !!profile.terms_accepted_at;
    if (!fullyOnboarded && !inOnboarding && !inAuth) {
      router.replace('/welcome');
    } else if (fullyOnboarded && (inOnboarding || inAuth)) {
      router.replace('/(tabs)');
    }
  }, [
    authReady,
    authState.status,
    loaded,
    legacyDataPending,
    profile?.age_gate_accepted_at,
    profile?.disclaimer_accepted_at,
    profile?.onboarding_done,
    profile?.terms_accepted_at,
    segments,
    router,
  ]);

  // Legacy-data detection on sign-in. If the local SQLite has rows that
  // predate accounts AND the profile hasn't been stamped as attributed
  // yet, the auth gate above routes to /(auth)/attribute-data before
  // letting the user reach tabs.
  useEffect(() => {
    if (authState.status !== 'signed-in') {
      setLegacyDataPending(false);
      return;
    }
    if (profile?.local_data_attributed_at) {
      setLegacyDataPending(false);
      return;
    }
    let cancelled = false;
    hasLegacyLocalData().then((has) => {
      if (!cancelled) setLegacyDataPending(has);
    });
    return () => {
      cancelled = true;
    };
  }, [authState.status, profile?.local_data_attributed_at]);

  // Founder celebration polling — only fires once per founder. Re-queries
  // every time the user transitions to signed-in; if they're a founder
  // and haven't yet seen the banner, the modal renders. Dismissal
  // server-stamps founder_banner_seen_at so it never re-fires.
  useEffect(() => {
    if (authState.status !== 'signed-in') return;
    let cancelled = false;
    getMyFounderStatus().then((s) => {
      if (cancelled || !s) return;
      if (s.isFounder && s.founderNumber != null && !s.bannerSeenAt) {
        setFounderBanner({
          visible: true,
          number: s.founderNumber,
          userId: authState.session.user.id,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [authState]);

  const dismissFounderBanner = useCallback(() => {
    setFounderBanner((s) => ({ ...s, visible: false }));
    if (founderBanner.userId) {
      void markFounderBannerSeen(founderBanner.userId).catch(() => {});
    }
  }, [founderBanner.userId]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(auth)" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="(onboarding)" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="peptide/[id]" />
        <Stack.Screen name="cycle/new" />
        <Stack.Screen name="cycle/[id]" />
        <Stack.Screen name="stack/new" />
        <Stack.Screen name="stack/[id]" />
        <Stack.Screen name="metric/[kind]" />
        <Stack.Screen name="settings" />
        <Stack.Screen
          name="log-dose"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="reconstitute"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="log-metric"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="journal-entry"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="injection-sites"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Stack>
      <FounderCelebrationModal
        visible={founderBanner.visible}
        founderNumber={founderBanner.number}
        onDismiss={dismissFounderBanner}
      />
    </>
  );
}

function BiometricGate({ children }: { children: React.ReactNode }) {
  const { t } = useTheme();
  const { profile, loaded } = useProfile();
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(false);
  const lockEnabled = loaded && profile?.biometric_lock === 1;

  const authenticate = useCallback(async () => {
    if (!lockEnabled) return;
    // No native module → APK predates biometric-lock; treat as
    // unlocked so the user can still use the app.
    if (!LocalAuthentication) {
      setAuthenticated(true);
      return;
    }
    setChecking(true);
    try {
      const [hasHardware, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      if (!hasHardware || !enrolled) {
        setAuthenticated(true);
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Helix',
        fallbackLabel: 'Use device passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      setAuthenticated(result.success);
    } finally {
      setChecking(false);
    }
  }, [lockEnabled]);

  useEffect(() => {
    if (!loaded) return;
    if (!lockEnabled) {
      setAuthenticated(true);
      return;
    }
    setAuthenticated(false);
    void authenticate();
  }, [authenticate, loaded, lockEnabled]);

  useEffect(() => {
    if (!lockEnabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void authenticate();
      } else {
        setAuthenticated(false);
      }
    });
    return () => sub.remove();
  }, [authenticate, lockEnabled]);

  if (!lockEnabled || authenticated) return <>{children}</>;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.bg,
        alignItems: 'center',
        justifyContent: 'center',
        padding: space.xl,
      }}
    >
      <Text style={{ color: t.ink, fontSize: 24, fontFamily: font.sansBold }}>
        Helix is locked
      </Text>
      <Pressable
        onPress={() => void authenticate()}
        disabled={checking}
        style={{
          marginTop: space.lg,
          paddingVertical: 12,
          paddingHorizontal: 18,
          borderRadius: radius.md,
          backgroundColor: checking ? t.surfaceAlt : t.ink,
        }}
      >
        <Text style={{ color: checking ? t.ink3 : t.bg, fontSize: 14, fontFamily: font.sansSemi }}>
          {checking ? 'Checking...' : 'Unlock'}
        </Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_600SemiBold,
    Fraunces_300Light,
    Fraunces_300Light_Italic,
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Fraunces_500Medium_Italic,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  useEffect(() => {
    initDatabase()
      .then(() => setDbReady(true))
      .catch((err) => {
        console.error('DB init failed', err);
        setDbReady(true);
      });
  }, []);

  // Re-schedule local notifications on launch and whenever the app returns
  // to the foreground. scheduleAllSafe is idempotent (cancels + re-creates)
  // and no-ops when prefs.mode === 'off' or permissions are denied.
  useEffect(() => {
    if (!dbReady) return;
    scheduleAllSafe();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') scheduleAllSafe();
    });
    return () => sub.remove();
  }, [dbReady]);

  // OTA updates check on launch. Only runs in release builds — dev builds
  // skip this (expo-updates is a no-op in __DEV__). Silent-fails on network
  // errors so it never blocks startup.
  useEffect(() => {
    if (__DEV__) return;
    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // offline or update server unreachable — ignore
      }
    })();
  }, []);

  useEffect(() => {
    if (fontsLoaded && dbReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, dbReady]);

  if (!fontsLoaded || !dbReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ProfileProvider>
          <ThemeProvider>
            <BiometricGate>
              <RootGate />
            </BiometricGate>
          </ThemeProvider>
        </ProfileProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
