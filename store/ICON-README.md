# Helix App Icon — Deliverables

A brass double-helix on cream, symbol-only, built to the engineer's icon brief. All files generated as clean vector → rendered to exact target sizes. Tested at 512px, 192px, 96px, 48px, and under Android circle + squircle adaptive masks (no clipping).

## Palette used
- Background: cream `#F3EDDE` → `#EFE7D6` (subtle diagonal gradient)
- Brass strands: `#D8BA76` → `#C9A961` → `#A8893F` (front), darker `#8B6914` → `#785A11` (back strand for depth)
- This matches the app's cream/brass/ink identity and **replaces the off-brand teal `#0A8E83`** the engineer flagged in the placeholder assets.

## Files

| File | Size | Purpose |
|------|------|---------|
| `play-store-icon-512.png` | 512×512 | **Google Play Store listing icon** (opaque) |
| `ios-app-store-icon-1024.png` | 1024×1024 | iOS App Store icon (opaque RGB, no alpha — Apple requires) |
| `android-adaptive-foreground-1024.png` | 1024×1024 | Android adaptive icon foreground (transparent, helix only, in safe zone) |
| `android-adaptive-background-1024.png` | 1024×1024 | Android adaptive icon background (solid cream) |
| `android-adaptive-monochrome-1024.png` | 1024×1024 | Android 13+ themed-icon monochrome layer (black on transparent) |
| `splash-1242x2436.png` | 1242×2436 | Splash screen (helix centered on cream) |
| `favicon-48.png` | 48×48 | Web favicon for the landing site |
| `helix-icon-master.svg` | vector | Master source (full icon w/ background) — edit this to regenerate |
| `helix-foreground-master.svg` | vector | Master source (helix only, transparent) |
| `CONTACT-SHEET.png` | — | Visual reference: icon at all sizes + mask tests |

## For the engineer — installing into the app

The brief calls for `app.json` edits (teal→cream). With these assets:

1. **Replace** the existing icon files in the repo (`assets/` or wherever the brief specifies) with the matching files above.
2. **Update `app.json`:**
   - `icon` → `./assets/play-store-icon-512.png` (or the iOS 1024 — Expo uses one master and downsizes)
   - `android.adaptiveIcon.foregroundImage` → the adaptive foreground
   - `android.adaptiveIcon.backgroundColor` → `"#F3EDDE"` (the cream — replaces teal `#0A8E83`)
   - `android.adaptiveIcon.monochromeImage` → the monochrome layer
   - `splash.backgroundColor` → `"#F3EDDE"`
   - `splash.image` → the splash file
   - `web.favicon` → the favicon
3. **Re-run the build checks** (`npm run check`) and rebuild.

## Notes & honest caveats

- **At 48px** (notification size) the rungs largely disappear and it reads as "a brass twisting form" rather than crisply resolving as DNA. This is normal — virtually every detailed icon simplifies at that size. It's still recognizable and on-brand. If you ever want a dedicated ultra-small variant, a 2-strand twist with no rungs would be marginally cleaner, but it's not necessary.
- This is a **strong, shippable icon.** If you later want a designer to polish it (e.g. add a subtle emboss, refine the gradient), hand them `CONTACT-SHEET.png` + the master SVG as the reference — but you do not need to. This is launch-ready.
- All raster files are generated from the SVG masters, so if you want any tweak (thicker strands, different brass tone, more/fewer twists), it's a quick regenerate from the SVG.
