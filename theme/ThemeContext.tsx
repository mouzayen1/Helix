import { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type Palette } from './tokens';

type Ctx = { t: Palette; isDark: boolean };

const ThemeCtx = createContext<Ctx>({ t: light, isDark: false });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const value = useMemo<Ctx>(
    () => ({ t: scheme === 'dark' ? dark : light, isDark: scheme === 'dark' }),
    [scheme]
  );
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
