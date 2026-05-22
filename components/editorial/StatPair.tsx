// Two- or three-cell stat display with vertical hairlines between
// cells. Used at the bottom of Reconstitute (TOTAL DOSES |
// ESTIMATED SUPPLY) and on Progress / Profile.
import { Text, View } from 'react-native';
import { useEditorialTheme } from '../../lib/design/theme';
import type { EditorialColors } from '../../lib/design/tokens';

type Cell = {
  value: string | number;
  unit?: string;
  label: string;
  color?: keyof EditorialColors;
};

export function StatPair({ cells }: { cells: Cell[] }) {
  const theme = useEditorialTheme();
  return (
    <View style={{ flexDirection: 'row' }}>
      {cells.map((cell, i) => {
        const valueColor = cell.color ? theme.colors[cell.color] : theme.colors.ink1;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              paddingVertical: 28,
              alignItems: 'center',
              borderLeftWidth: i === 0 ? 0 : 1,
              borderLeftColor: theme.colors.line,
            }}
          >
            <Text
              style={{
                fontFamily: theme.typography.eyebrow.fontFamily,
                fontSize: theme.typography.eyebrow.fontSize,
                letterSpacing: theme.typography.eyebrow.letterSpacing,
                color: theme.colors.ink3,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              {cell.label}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text
                style={{
                  fontFamily: theme.fraunces('Fraunces_300Light'),
                  fontSize: 40,
                  letterSpacing: -1,
                  color: valueColor,
                }}
              >
                {cell.value}
              </Text>
              {cell.unit ? (
                <Text
                  style={{
                    fontFamily: theme.fraunces('Fraunces_300Light'),
                    fontSize: 16,
                    color: theme.colors.ink3,
                    marginLeft: 2,
                  }}
                >
                  {cell.unit}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
