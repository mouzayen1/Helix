// Auth stack — no tab bar, no biometric gate (you have to sign in first).
import { Stack } from 'expo-router';
import { useEditorialTheme } from '../../lib/design/theme';

export default function AuthLayout() {
  const ed = useEditorialTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: ed.colors.bg },
        animation: 'slide_from_right',
        gestureEnabled: false, // can't swipe back from sign-up
      }}
    >
      <Stack.Screen name="sign-up" options={{ animation: 'fade' }} />
      <Stack.Screen name="accept-terms" options={{ gestureEnabled: false }} />
      <Stack.Screen name="email-sign-up" />
      <Stack.Screen name="email-sign-in" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
