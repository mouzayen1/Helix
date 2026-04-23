// SVG icons — ported from prototype H_ICON. react-native-svg primitives.
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type Props = { size?: number; color?: string };

export const IconPlus = ({ size = 18, color = 'currentColor' }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Path d="M9 3v12M3 9h12" />
  </Svg>
);

export const IconChevronRight = ({ size = 14, color = 'currentColor' }: Props) => (
  <Svg width={(size * 8) / 14} height={size} viewBox="0 0 8 14" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M1 1l6 6-6 6" />
  </Svg>
);

export const IconChevronLeft = ({ size = 16, color = 'currentColor' }: Props) => (
  <Svg width={(size * 10) / 16} height={size} viewBox="0 0 10 16" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M8 1L2 8l6 7" />
  </Svg>
);

export const IconSearch = ({ size = 16, color = 'currentColor' }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={1.6}>
    <Circle cx={7} cy={7} r={5} />
    <Path d="M11 11l3.5 3.5" strokeLinecap="round" />
  </Svg>
);

export const IconSyringe = ({ size = 18, color = 'currentColor' }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M11 2l5 5M13 4l-8 8-3 0 0-3 8-8M10 7l1 1" />
  </Svg>
);

export const IconBolt = ({ size = 16, color = 'currentColor' }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill={color}>
    <Path d="M9 1L2 9h4l-1 6 7-8H8l1-6z" />
  </Svg>
);

export const IconClock = ({ size = 16, color = 'currentColor' }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={1.5}>
    <Circle cx={8} cy={8} r={6} />
    <Path d="M8 5v3l2 1.5" strokeLinecap="round" />
  </Svg>
);

export const IconFlame = ({ size = 14, color = 'currentColor' }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 14 14" fill={color}>
    <Path d="M7 1c0 3-3 3-3 6a3 3 0 006 0c0-1-1-2-1-3 1 0 2 2 2 3a4 4 0 01-8 0c0-3 3-4 4-6z" />
  </Svg>
);

export const IconCheck = ({ size = 12, color = 'currentColor' }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2 6l3 3 5-6" />
  </Svg>
);

export const IconBook = ({ size = 18, color = 'currentColor' }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round">
    <Path d="M3 3h5a2 2 0 012 2v10a2 2 0 00-2-2H3V3zM15 3h-5a2 2 0 00-2 2v10a2 2 0 012-2h5V3z" />
  </Svg>
);

export const IconHome = ({ size = 18, color = 'currentColor' }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round">
    <Path d="M2 9l7-6 7 6v7H2V9z" />
  </Svg>
);

export const IconChart = ({ size = 18, color = 'currentColor' }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round">
    <Path d="M2 14l4-5 3 2 5-7" />
    <Path d="M2 2v14h14" />
  </Svg>
);

export const IconCog = ({ size = 18, color = 'currentColor' }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth={1.5}>
    <Circle cx={9} cy={9} r={2.5} />
    <Path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.6 3.6l1.4 1.4M13 13l1.4 1.4M3.6 14.4L5 13M13 5l1.4-1.4" />
  </Svg>
);

export const IconClose = ({ size = 14, color = 'currentColor' }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
    <Path d="M2 2l10 10M12 2L2 12" />
  </Svg>
);

export const IconFilter = ({ size = 14, color = 'currentColor' }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round">
    <Path d="M1 2h12L8 8v5L6 11V8L1 2z" />
  </Svg>
);

export const IconDot = ({ size = 6, color = 'currentColor' }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 6 6">
    <Circle cx={3} cy={3} r={3} fill={color} />
  </Svg>
);
