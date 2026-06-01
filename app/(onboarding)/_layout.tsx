import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { getAuthState, subscribeAuth, type AuthState } from '../../lib/auth/session';
import { isAuthConfigured } from '../../lib/supabase';

export default function OnboardingLayout() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>(getAuthState());
  const accountRequired = Platform.OS === 'web' || isAuthConfigured();

  useEffect(() => {
    setAuthState(getAuthState());
    return subscribeAuth(setAuthState);
  }, []);

  useEffect(() => {
    if (!accountRequired) return;
    if (isAuthConfigured() && authState.status === 'loading') return;
    router.replace(authState.status === 'signed-in' ? '/(tabs)' : '/(auth)/sign-up');
  }, [accountRequired, authState.status, router]);

  if (accountRequired) return null;

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
  );
}
