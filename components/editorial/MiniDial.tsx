// Small circular dial used in the dial-row beneath the hero ring on
// Today. Same SVG construction as HeroRing at a quarter of the size
// — separate component so the prop surface stays narrow (no glow,
// no tracked color slot beyond the ring color).
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

export function MiniDial({
  value,
  total,
  unit,
  color = 'stateOptimal',
  label,
  size = 56,
}: {
  // value is 0–100 if `total` is undefined; if `total` is given, value
  // is taken literally and the percentage is value/total.
  value: number;
  total?: number;
  unit?: string;
  color?: StateKey;
  label?: string;
  size?: number;
}) {
  const theme = useEditorialTheme();
  const stroke = theme.colors[color as keyof EditorialColors] as string;

  const strokeWidth = 1.5;
  const radius = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total != null ? Math.max(0, Math.min(1, value / total)) : Math.max(0, Math.min(1, value / 100));
  const dashOffset = circumference * (1 - pct);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={theme.colors.line}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={stroke}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 14 }}>
        <Text
          style={{
            fontFamily: theme.fraunces('Fraunces_400Regular'),
            fontSize: 22,
            color: theme.colors.ink1,
          }}
        >
          {value}{total != null ? '' : ''}
        </Text>
        {total != null ? (
          <Text
            style={{
              fontFamily: theme.fraunces('Fraunces_400Regular'),
              fontSize: 14,
              color: theme.colors.ink3,
              marginLeft: 1,
            }}
          >
            /{total}
          </Text>
        ) : null}
        {unit ? (
          <Text
            style={{
              fontFamily: theme.fraunces('Fraunces_400Regular'),
              fontSize: 12,
              color: theme.colors.ink3,
              marginLeft: 2,
            }}
          >
            {unit}
          </Text>
        ) : null}
      </View>
      {label ? (
        <Text
          style={{
            marginTop: 6,
            fontFamily: theme.typography.labelSm.fontFamily,
            fontSize: theme.typography.labelSm.fontSize,
            letterSpacing: theme.typography.labelSm.letterSpacing,
            color: theme.colors.ink3,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}
