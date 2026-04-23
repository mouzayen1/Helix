import { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useProfile } from '../lib/profile-context';
import { dark, light, type Palette } from './tokens';

type Ctx = { t: Palette; isDark: boolean };

const ThemeCtx = createContext<Ctx>({ t: light, isDark: false });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const { profile } = useProfile();
  const value = useMemo<Ctx>(() => {
    const pref = profile?.theme ?? 'system';
    const isDark =
      pref === 'dark' ? true : pref === 'light' ? false : scheme === 'dark';
    return { t: isDark ? dark : light, isDark };
  }, [scheme, profile?.theme]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
