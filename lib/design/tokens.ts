// Editorial design tokens — Helix v1.0 visual overhaul.
//
// This is a parallel token system to theme/tokens.ts. The legacy palette
// (HCard / HSectionHeader / etc.) keeps working for screens that haven't
// been migrated to the editorial language yet; new screens consume these
// tokens via useEditorialTheme().
//
// Two color modes — dark (default) and light — are TRUE COUNTERPARTS,
// not a single palette inverted. Brand brass shifts from aged (#C9A961)
// in dark to deep antique (#8B6914) in light because aged brass against
// cream washes out to beige. State colors deepen for light because light
// backgrounds need more saturation to read. Typography weights are
// shared between modes — light defaults the headline weight one step
// heavier (Fraunces 400) since thin strokes wash on cream paper.

export type EditorialColors = {
  bg: string;
  bgCard: string;
  bgElevated: string;
  bgRecessed: string;

  // State colors carry semantic meaning — never decorative.
  stateOptimal: string;   // peak, on-track, ready
  stateGood: string;      // healthy, sustaining, active
  stateModerate: string;  // pending, watch this
  stateLow: string;       // underperforming
  stateWarn: string;      // attention needed

  // Brand accent — distinctive (not blue, not green).
  brand: string;
  brandSoft: string;
  brandLine: string;

  // Text hierarchy.
  ink1: string;
  ink2: string;
  ink3: string;
  ink4: string;
  inkDisabled: string;

  // Hairlines.
  line: string;
  lineStrong: string;
};

export const darkColors: EditorialColors = {
  bg: '#000000',
  bgCard: '#0E0E10',
  bgElevated: '#161618',
  bgRecessed: '#050506',

  stateOptimal: '#16A085',
  stateGood: '#6FCF97',
  stateModerate: '#F2C94C',
  stateLow: '#F2994A',
  stateWarn: '#EB5757',

  brand: '#C9A961',
  brandSoft: 'rgba(201, 169, 97, 0.12)',
  brandLine: 'rgba(201, 169, 97, 0.32)',

  ink1: '#F4F4F5',
  ink2: '#B4B4B8',
  ink3: '#6B6B70',
  ink4: '#404045',
  inkDisabled: '#2A2A2D',

  line: '#1F1F22',
  lineStrong: '#2A2A2D',
};

// Light is a *true counterpart*, recalibrated end-to-end. Cream paper +
// deep antique brass + deeper state colors + heavier serif weights. The
// goal is "premium publication" not "inverted dark theme."
export const lightColors: EditorialColors = {
  bg: '#F5F0E6',           // warm cream paper (not pure white)
  bgCard: '#EDE6D7',
  bgElevated: '#FFFBF2',
  bgRecessed: '#E5DCC9',

  stateOptimal: '#0F766E', // deeper teal — saturation lift for light bg
  stateGood: '#15803D',    // forest green
  stateModerate: '#B45309',// burnt amber
  stateLow: '#C2410C',
  stateWarn: '#B91C1C',

  brand: '#8B6914',        // deep antique brass — reads on cream
  brandSoft: 'rgba(139, 105, 20, 0.10)',
  brandLine: 'rgba(139, 105, 20, 0.32)',

  ink1: '#1A1714',
  ink2: '#544D44',
  ink3: '#857B6E',
  ink4: '#B5AA9C',
  inkDisabled: '#D6CCBC',

  line: 'rgba(26, 23, 20, 0.10)',
  lineStrong: 'rgba(26, 23, 20, 0.20)',
};

// Spacing scale (px). Numeric keys mirror Tailwind for muscle memory.
export const spacing = {
  px: 1,
  '0': 0,
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
  '10': 40,
  '12': 48,
  '16': 64,
  '20': 80,
  '24': 96,
} as const;

// Editorial design uses very few rounded corners. Most things are
// sharp-cornered and hairline-driven.
export const radius = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 6,
  full: 9999,
} as const;

// Three-typeface system.
//
// Fraunces: ALL headlines + hero numbers + editorial italic accents.
// Inter: body text + buttons.
// DM Mono: every quantitative datum, label, eyebrow.
//
// Light-mode callers should use `displayWeightFor(isDark)` to bump the
// Fraunces weight up one step on cream paper (300 -> 400) so thin
// strokes don't wash. The token defines size + line-height + letter-
// spacing only; the resolved fontFamily is picked at render time.
export type TypographyToken = {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontFamily?: string;
  textTransform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
};

export const typography = {
  // FRAUNCES — Light (300) on dark, Regular (400) on light. See
  // resolveFraunces() below for the runtime swap.
  heroDisplay: {
    fontSize: 96,
    lineHeight: 84,
    letterSpacing: -6,
    fontFamily: 'Fraunces_300Light',
  },
  hero: {
    fontSize: 88,
    lineHeight: 76,
    letterSpacing: -5,
    fontFamily: 'Fraunces_300Light',
  },
  display: {
    fontSize: 40,
    lineHeight: 40,
    letterSpacing: -1.5,
    fontFamily: 'Fraunces_300Light',
  },
  displayItalic: {
    fontSize: 40,
    lineHeight: 40,
    letterSpacing: -1.5,
    fontFamily: 'Fraunces_300Light_Italic',
  },
  title1: {
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.8,
    fontFamily: 'Fraunces_400Regular',
  },
  title1Italic: {
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.8,
    fontFamily: 'Fraunces_400Regular_Italic',
  },
  title2: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    fontFamily: 'Fraunces_400Regular',
  },
  title2Italic: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    fontFamily: 'Fraunces_400Regular_Italic',
  },
  title3: {
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.3,
    fontFamily: 'Fraunces_400Regular',
  },

  // INTER — body text + buttons only.
  bodyMd: {
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.1,
    fontFamily: 'Inter_400Regular',
  },
  bodySm: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
    fontFamily: 'Inter_400Regular',
  },
  bodyStrong: {
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.1,
    fontFamily: 'Inter_500Medium',
  },

  // DM MONO — all data, labels, eyebrows.
  label: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.5,
    fontFamily: 'DMMono_500Medium',
    textTransform: 'uppercase' as const,
  },
  labelSm: {
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.8,
    fontFamily: 'DMMono_500Medium',
    textTransform: 'uppercase' as const,
  },
  eyebrow: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 2.5,
    fontFamily: 'DMMono_500Medium',
    textTransform: 'uppercase' as const,
  },
  dataMd: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
    fontFamily: 'DMMono_500Medium',
  },
  dataLg: {
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
    fontFamily: 'DMMono_500Medium',
  },
} satisfies Record<string, TypographyToken>;

// Light mode bumps Fraunces 300 -> 400 (and 400 -> 500) because thin
// strokes wash on cream backgrounds. Dark mode keeps the published
// weights. Apply at render time in EditorialHeadline.
export function resolveFraunces(family: string, isDark: boolean): string {
  if (isDark) return family;
  if (family === 'Fraunces_300Light') return 'Fraunces_400Regular';
  if (family === 'Fraunces_300Light_Italic') return 'Fraunces_400Regular_Italic';
  if (family === 'Fraunces_400Regular') return 'Fraunces_500Medium';
  if (family === 'Fraunces_400Regular_Italic') return 'Fraunces_500Medium_Italic';
  return family;
}

export const motion = {
  easeStandard: [0.16, 1, 0.3, 1] as const,
  easeIn: [0.4, 0, 1, 1] as const,
  easeOut: [0, 0, 0.2, 1] as const,
  easeSpring: { damping: 20, stiffness: 300 },
  durationMicro: 100,
  durationDefault: 200,
  durationDeliberate: 300,
  durationHero: 500,
} as const;
