import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { IBMPlexMono_400Regular, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from '../lib/db';
import { scheduleAllSafe } from '../lib/notifications';
import { ProfileProvider, useProfile } from '../lib/profile-context';
import { ThemeProvider, useTheme } from '../theme/ThemeContext';
import { font, radius, space } from '../theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootGate() {
  const { t, isDark } = useTheme();
  const { profile, loaded } = useProfile();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!loaded) return;
    const inOnboarding = segments[0] === '(onboarding)' || segments[0] === 'welcome';
    const fullyOnboarded =
      profile?.onboarding_done === 1 &&
      !!profile.age_gate_accepted_at &&
      !!profile.disclaimer_accepted_at &&
      !!profile.terms_accepted_at;
    if (!fullyOnboarded && !inOnboarding) {
      router.replace('/welcome');
    } else if (fullyOnboarded && inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [
    loaded,
    profile?.age_gate_accepted_at,
    profile?.disclaimer_accepted_at,
    profile?.onboarding_done,
    profile?.terms_accepted_at,
    segments,
    router,
  ]);

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
