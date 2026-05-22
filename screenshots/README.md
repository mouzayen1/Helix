# App screenshot + landing-visual generator

Renders faithful HTML/CSS recreations of the app's editorial screens to
PNG, using the real design tokens (`lib/design/tokens.ts`) and the real
brand fonts. Output feeds two places:

- **Play Store screenshots** → `store/screenshots/*.png` (1236×2472, 2:1, opaque RGB)
- **Landing-page app visuals** → copied to `site/app-*.png`

These are *recreations*, not live captures from the RN runtime — but
they're built one-to-one from the same tokens, type scale, and screen
layouts (see the per-screen spec the markup was built from). Editing the
real screens? Update the matching `*.html` here so the store assets stay
truthful.

## Regenerate

Playwright + Chromium are intentionally **not** in `package.json` (they'd
bloat the app manifest). Install them on demand:

```bash
npm i -D playwright
npx playwright install chromium

# fonts: copy the brand ttfs out of node_modules into ./fonts (gitignored)
mkdir -p screenshots/fonts
cp node_modules/@expo-google-fonts/fraunces/{300Light,300Light_Italic,400Regular,400Regular_Italic,500Medium,500Medium_Italic,600SemiBold}/*.ttf screenshots/fonts/
cp node_modules/@expo-google-fonts/dm-mono/{400Regular,500Medium}/*.ttf screenshots/fonts/
cp node_modules/@expo-google-fonts/inter/Inter_{400Regular,500Medium,600SemiBold}.ttf screenshots/fonts/

# render all five screens
node screenshots/render.mjs            # or: node screenshots/render.mjs today cycle
```

## Files

| File | Purpose |
|------|---------|
| `app.css` | The editorial light-theme component styles (mirrors the app tokens) |
| `today.html` `reconstitute.html` `cycle.html` `peptide.html` `stacks.html` | The five screens |
| `render.mjs` | Renders each screen at 412×824 logical @3x → 1236×2472 PNG |
| `fonts/` | Brand ttfs (gitignored — copy from node_modules, see above) |

## Play Store captions

| Screenshot | Suggested caption |
|------------|-------------------|
| `today.png` | Every dose, every cycle — one screen. |
| `reconstitute.png` | Reconstitution math, done right. |
| `cycle.png` | Track cycles with precision. |
| `peptide.png` | 43 peptides. Sourced. Honest. |
| `stacks.png` | Run multiple protocols at once. |
