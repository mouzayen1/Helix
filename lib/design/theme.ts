// Editorial theme hook — picks dark or light palette based on user
// preference (system / always-dark / always-light) layered on top of OS
// Appearance.
//
// Intentionally separate from theme/ThemeContext — that one feeds the
// legacy palette to screens that still consume it. Once every screen is
// migrated to the editorial primitives, theme/ThemeContext can be
// retired. Until then, both run in parallel.
//
// Appearance.addChangeListener returns a Subscription with .remove();
// the cleanup function in useEffect MUST call sub.remove() or the
// listener leaks across hot-reloads and on phones that flip between
// system theme automatically (Android dark-mode schedule, iOS auto).
import { useEffect, useState } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';
import { useProfile } from '../profile-context';
import {
  darkColors,
  lightColors,
  resolveFraunces,
  typography,
  type EditorialColors,
  type TypographyToken,
} from './tokens';

export type ThemePreference = 'system' | 'light' | 'dark';

export type EditorialTheme = {
  colors: EditorialColors;
  typography: typeof typography;
  isDark: boolean;
  // Helper that returns the right Fraunces family for the active mode.
  // Use inside <EditorialHeadline> + any custom serif renderings.
  fraunces: (family: string) => string;
  // Resolves a typography token's fontFamily through the Fraunces lift.
  // Pass any token; non-Fraunces families pass through unchanged.
  resolveType: (tok: TypographyToken) => TypographyToken;
};

export function useEditorialTheme(): EditorialTheme {
  const { profile } = useProfile();
  const pref: ThemePreference = (profile?.theme as ThemePreference) ?? 'system';

  // Track OS-level scheme so 'system' preference reacts to OS toggles
  // without requiring a relaunch. Initial value comes from Appearance,
  // updates come from the change listener.
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme()
  );

  useEffect(() => {
    // Common RN bug: Appearance.addChangeListener returns a
    // Subscription, not a cleanup function. The cleanup must explicitly
    // call sub.remove() — otherwise the listener leaks every render.
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const isDark =
    pref === 'dark' ? true : pref === 'light' ? false : systemScheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  const fraunces = (family: string) => resolveFraunces(family, isDark);
  const resolveType = (tok: TypographyToken): TypographyToken =>
    tok.fontFamily?.startsWith('Fraunces')
      ? { ...tok, fontFamily: fraunces(tok.fontFamily) }
      : tok;

  return { colors, typography, isDark, fraunces, resolveType };
}
