// Design tokens for Helix — ported from prototype lib/tokens.js
// Spec §08. Every color, spacing, and font decision lives here.

export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  ink2: string;
  ink3: string;
  ink4: string;
  line: string;
  lineStrong: string;
  accent: string;
  accentSoft: string;
  accentInk: string;
  warn: string;
  warnSoft: string;
  danger: string;
  success: string;
};

export const light: Palette = {
  bg: '#F5F2EC',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEBE2',
  ink: '#14120E',
  ink2: '#3D3A34',
  ink3: '#7A756C',
  ink4: '#B5AFA3',
  line: 'rgba(20,18,14,0.08)',
  lineStrong: 'rgba(20,18,14,0.14)',
  accent: '#0A8E83',
  accentSoft: '#D4ECE8',
  accentInk: '#064842',
  warn: '#C48A2E',
  warnSoft: '#F4E6C9',
  danger: '#B8453A',
  success: '#4C8B5A',
};

export const dark: Palette = {
  bg: '#0E1113',
  surface: '#171B1E',
  surfaceAlt: '#20252A',
  ink: '#F0EDE6',
  ink2: '#C2BDB2',
  ink3: '#85807A',
  ink4: '#4A4842',
  line: 'rgba(240,237,230,0.08)',
  lineStrong: 'rgba(240,237,230,0.16)',
  accent: '#4FC9BD',
  accentSoft: '#12302E',
  accentInk: '#A8E5DE',
  warn: '#E6B762',
  warnSoft: '#3A2E18',
  danger: '#E07068',
  success: '#7BB38A',
};

export const font = {
  sans: 'Inter_400Regular',
  sansMed: 'Inter_500Medium',
  sansSemi: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoSemi: 'IBMPlexMono_600SemiBold',
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const space = {
  xs: 4,
  s: 8,
  sm: 10,
  m: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  x3: 28,
  x4: 32,
  x5: 40,
  x6: 56,
  x7: 80,
};
