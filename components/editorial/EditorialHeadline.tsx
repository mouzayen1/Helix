// Serif headline with inline italic emphasis. The most-used component
// in the editorial system. Marks `*…*` segments inside the string and
// renders those parts in the italic counterpart of the chosen size,
// tinted ink2 so the italic reads as quiet emphasis (not shouting).
//
// Example:
//   <EditorialHeadline size="display">Healing *Stack*</EditorialHeadline>
// Renders "Healing" in Fraunces (light or regular based on theme) and
// "Stack" in the italic counterpart, in ink2.
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useEditorialTheme } from '../../lib/design/theme';
import type { TypographyToken } from '../../lib/design/tokens';

type Size = 'display' | 'title1' | 'title2' | 'title3';

export function EditorialHeadline({
  children,
  size = 'display',
  color,
  italicColor,
  style,
}: {
  children: string;
  size?: Size;
  color?: string;
  italicColor?: string;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useEditorialTheme();
  const baseToken = pickToken(theme.typography, size, false);
  const italicToken = pickToken(theme.typography, size, true);

  const baseStyle = tokenToStyle(theme.resolveType(baseToken));
  const italicStyle = tokenToStyle(theme.resolveType(italicToken));

  const inkBase = color ?? theme.colors.ink1;
  const inkItalic = italicColor ?? theme.colors.ink2;

  // Split on *…* boundaries; even indices are plain, odd indices are italic.
  const parts = children.split(/\*([^*]+)\*/g);

  return (
    <Text style={[baseStyle, { color: inkBase }, style]} accessibilityRole="header">
      {parts.map((part, i) =>
        i % 2 === 0 ? (
          <Text key={i}>{part}</Text>
        ) : (
          <Text key={i} style={[italicStyle, { color: inkItalic }]}>
            {part}
          </Text>
        )
      )}
    </Text>
  );
}

function pickToken(
  t: ReturnType<typeof useEditorialTheme>['typography'],
  size: Size,
  italic: boolean
): TypographyToken {
  if (size === 'display') return italic ? t.displayItalic : t.display;
  if (size === 'title1') return italic ? t.title1Italic : t.title1;
  if (size === 'title2') return italic ? t.title2Italic : t.title2;
  // title3 has no canonical italic variant; reuse the regular title3.
  return t.title3;
}

function tokenToStyle(tok: TypographyToken): TextStyle {
  return {
    fontFamily: tok.fontFamily,
    fontSize: tok.fontSize,
    lineHeight: tok.lineHeight,
    letterSpacing: tok.letterSpacing,
  };
}
