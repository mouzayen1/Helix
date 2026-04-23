// Design tokens for Helix — ported from spec v2.0 §08.
// Every color, spacing, and font decision lives here.

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
  dangerSoft: string;
  success: string;
  successSoft: string;
};

export const light: Palette = {
  bg: '#F5F2EC',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEBE2',
  ink: '#14120E',
  ink2: '#4A443A',
  ink3: '#807A6E',
  ink4: '#B8B0A3',
  line: 'rgba(20,18,14,0.08)',
  lineStrong: 'rgba(20,18,14,0.14)',
  accent: '#0A8E83',
  accentSoft: '#D5EEEB',
  accentInk: '#064842',
  warn: '#C48A2E',
  warnSoft: '#F9ECD0',
  danger: '#B8453A',
  dangerSoft: '#F4D4D1',
  success: '#4C8B5A',
  successSoft: '#D7E7DB',
};

export const dark: Palette = {
  bg: '#0E1114',
  surface: '#171B1E',
  surfaceAlt: '#22272A',
  ink: '#F0EDE6',
  ink2: '#B8B0A3',
  ink3: '#807A6E',
  ink4: '#4A443A',
  line: 'rgba(240,237,230,0.08)',
  lineStrong: 'rgba(240,237,230,0.16)',
  accent: '#4FC9BD',
  accentSoft: '#12332F',
  accentInk: '#A8E5DE',
  warn: '#E3B15C',
  warnSoft: '#3A2E18',
  danger: '#D76A5E',
  dangerSoft: '#3A1C19',
  success: '#7FB069',
  successSoft: '#1D2E1F',
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
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
};

export const size = {
  display: { fontSize: 34, lineHeight: 38 },
  title: { fontSize: 28, lineHeight: 32 },
  h1: { fontSize: 22, lineHeight: 26 },
  h2: { fontSize: 17, lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 11, lineHeight: 14 },
  monoNum: { fontSize: 15, lineHeight: 22 },
  monoMeta: { fontSize: 11, lineHeight: 14 },
};
