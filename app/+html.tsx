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

        {/* Mobile-web polish layer. React Native Web exports TextInput as
            an unstyled <input>, and the native screen layouts were drawn
            for a fixed-width phone — both look broken in a real mobile
            browser. This stylesheet:
              • Stops the page from scrolling sideways when a fixed-width
                row overflows the viewport (the "content cut off on the
                left" symptom).
              • Forces every input to ≥16px font so iOS Safari doesn't
                auto-zoom the viewport on focus.
              • Removes Safari's input default styling that misaligns with
                our editorial type.
              • Improves tap responsiveness (no 300ms delay).
            Desktop is unaffected — every override is either viewport-
            independent or guarded inside a max-width media query. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* Stop horizontal scroll — root cause of "content cut off
                 on the left" on mobile. Native ScrollViews export as
                 divs that can overflow their viewport. */
              html, body, #root {
                max-width: 100vw;
                overflow-x: hidden;
              }
              /* Better tap behaviour on mobile. */
              html {
                -webkit-tap-highlight-color: transparent;
                touch-action: manipulation;
              }

              /* Inputs — react-native-web TextInput maps to <input>/<textarea>. */
              input, textarea, select {
                -webkit-appearance: none;
                appearance: none;
                font-family: inherit;
              }
              /* iOS Safari auto-zooms the viewport whenever an input
                 receives focus and its font-size is < 16px. Force 16px
                 on small viewports to defeat that. The visual size
                 difference vs the editorial spec is small enough to
                 accept; it only kicks in on phone widths. */
              @media (max-width: 600px) {
                input, textarea, select {
                  font-size: 16px !important;
                }
                /* Make every input fill the row instead of spilling
                   out. Components that already cap width override
                   this via inline style which has higher specificity. */
                input, textarea {
                  max-width: 100% !important;
                  box-sizing: border-box;
                }
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
