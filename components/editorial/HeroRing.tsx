// Big circular progress ring with a serif number in the center —
// the hero metric on Today and Cycle Detail screens.
//
// Two SVG circles rendered from a single circumference:
//   1. background ring at colors.line (full circle)
//   2. progress ring rotated -90° so 0% starts at 12 o'clock, with
//      stroke-dashoffset advancing clockwise.
//
// Optional outer "glow" stroke at lower opacity creates the soft halo
// from the references — small detail but it's what separates a generic
// progress ring from a calibrated one.
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useEditorialTheme } from '../../lib/design/theme';
import type { EditorialColors } from '../../lib/design/tokens';

type StateKey =
  | 'stateOptimal'
  | 'stateGood'
  | 'stateModerate'
  | 'stateLow'
  | 'stateWarn'
  | 'brand';

export function HeroRing({
  value,
  size = 240,
  color = 'stateOptimal',
  label,
  unit = '%',
  glow = true,
}: {
  value: number;
  size?: number;
  color?: StateKey;
  label?: string;
  unit?: string;
  glow?: boolean;
}) {
  const theme = useEditorialTheme();
  const stroke = theme.colors[color as keyof EditorialColors] as string;

  const trackWidth = 1.5;       // background ring stroke width
  const progressWidth = 3;      // foreground progress stroke width
  const glowWidth = 6;          // soft halo behind the progress arc
  const padding = glow ? glowWidth : progressWidth;
  const radius = (size - padding) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const dashOffset = circumference * (1 - clamped / 100);

  const numberStyle = {
    fontFamily: theme.fraunces('Fraunces_300Light'),
    fontSize: size * 0.34,
    lineHeight: size * 0.34,
    letterSpacing: -size * 0.013,
    color: theme.colors.ink1,
  };
  const unitStyle = {
    fontFamily: theme.fraunces('Fraunces_300Light'),
    fontSize: size * 0.1,
    color: stroke,
  };

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* background track */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={theme.colors.line}
          strokeWidth={trackWidth}
          fill="none"
        />
        {/* glow halo behind progress */}
        {glow ? (
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={stroke}
            strokeOpacity={0.18}
            strokeWidth={glowWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ) : null}
        {/* progress arc */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={stroke}
          strokeWidth={progressWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>

      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={numberStyle}>{Math.round(clamped)}</Text>
          <Text style={unitStyle}>{unit}</Text>
        </View>
        {label ? (
          <Text
            style={{
              marginTop: 8,
              fontFamily: theme.typography.eyebrow.fontFamily,
              fontSize: theme.typography.eyebrow.fontSize,
              letterSpacing: theme.typography.eyebrow.letterSpacing,
              color: theme.colors.ink3,
              textTransform: 'uppercase',
            }}
          >
            {label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
