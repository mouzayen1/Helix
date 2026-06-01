// Wide-viewport (desktop/laptop web) layout helpers for the auth flow.
//
// On a phone — native, mobile-web, or the installed PWA — every auth
// screen keeps its full-bleed layout. Once the viewport is laptop-wide,
// full-width inputs and buttons spanning ~1400px read as broken, so we
// constrain content to a centered column.
//
// Gated on viewport WIDTH, not `Platform.OS === 'web'`, so mobile-web and
// the installed PWA stay on the phone layout that already works there.
import type { ReactNode } from 'react';
import { Platform, useWindowDimensions, View, type ViewStyle } from 'react-native';

// Below this width we render the untouched phone layout. 768 is the
// conventional tablet/desktop break; narrower web viewports (phones,
// split-screen) keep the full-bleed design.
export const WIDE_WEB_BREAKPOINT = 768;

// Editorial auth columns read best around a paperback measure: 440 keeps
// the line length comfortable and the buttons from sprawling. Matches the
// inline column width on the sign-up screen.
export const AUTH_COLUMN_MAX_WIDTH = 440;

/** True only on web viewports wide enough to need the centered-column layout. */
export function useWideWeb(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_WEB_BREAKPOINT;
}

/**
 * Constrains children to a centered, max-width column on wide web; renders
 * them untouched (no wrapper node) everywhere else. Drop it around the
 * scrollable content of a top-aligned auth form — because it returns a bare
 * fragment below the breakpoint, the phone layout's flex behavior is
 * byte-identical to having no wrapper at all.
 */
export function WebColumn({
  children,
  maxWidth = AUTH_COLUMN_MAX_WIDTH,
  style,
}: {
  children: ReactNode;
  maxWidth?: number;
  style?: ViewStyle;
}) {
  const wide = useWideWeb();
  if (!wide) return <>{children}</>;
  return (
    <View style={[{ width: '100%', maxWidth, alignSelf: 'center' }, style]}>
      {children}
    </View>
  );
}
