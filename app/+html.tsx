// Custom HTML document for the web build (static rendering). Expo Router
// wraps every statically-rendered route in this shell. We use it to wire
// up the PWA manifest and the Apple "Add to Home Screen" meta tags —
// installing to the home screen is what lets an iPhone web user escape
// Safari's ~7-day storage eviction and get an app-like, standalone launch.
import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover so safe-area insets work in standalone mode. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#F3EDDE" />

        {/* Apple "Add to Home Screen" */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Helix" />
        <link rel="apple-touch-icon" href="/icon.png" />

        {/* Disable body scrolling on web so the ScrollView behaves like
            native. Required by Expo Router for the root layout. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
