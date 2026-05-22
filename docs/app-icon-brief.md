# Helix — App icon brief

Goal: a single, recognizable mark for the Play Store listing, the
Android adaptive icon, iOS, and web — consistent with the app's
editorial brand (warm cream paper, antique brass, ink). Hand this to a
designer or an image-generation tool; the **Deliverables** table is the
contract.

---

## 0. Brand-alignment fix (read first)

The current placeholder icons are **off-brand**. `app.json` sets the
adaptive-icon and splash background to teal `#0A8E83`, but the shipped
app palette (`lib/design/tokens.ts`) is cream + antique brass + ink with
**no teal**. The new icon must drop the teal and use the brand palette
below, and `app.json` `backgroundColor` values should be updated to
match once the new art lands.

---

## 1. Palette (exact tokens — do not improvise hex)

| Role | Hex | Use in icon |
|---|---|---|
| Cream paper | `#F5F0E6` | Primary background field |
| Elevated paper | `#FFFBF2` | Optional highlight/paper sheen |
| Antique brass (light) | `#8B6914` | Primary mark color on cream |
| Aged brass (dark) | `#C9A961` | Mark color if on a dark/ink field |
| Ink | `#1A1714` | Hairline detail, or mark on brass |
| Ink (recessed) | `#0E1113` | Only if a dark variant is needed |

---

## 2. Concept

**The mark is a symbol, not a wordmark.** No text in the icon (it's
illegible at 48 px and Fraunces letterforms don't survive masking).

**Primary concept — "Brass helix ribbon."**
A clean double-helix ribbon (2 intertwined strands, 3–4 cross-rungs),
centered, rendered in antique brass `#8B6914` on a warm cream `#F5F0E6`
field. Strands have slightly tapered ends (editorial, engraved feel),
optional 1 px ink `#1A1714` hairline for definition. Subtle, *very*
restrained paper grain on the background is acceptable; no gradients
loud enough to read as glossy.

**Alternate concept — "Inverted plate."**
Aged brass `#C9A961` helix on an ink `#1A1714` field — reads as an
engraved brass plate. Use this only if the cream version feels too low
contrast at small sizes.

**Silhouette test:** the helix must be recognizable as a single solid
silhouette at 48 px. Keep rungs thick enough not to disappear; avoid
fine serifs, thin outlines, or more than ~4 rungs.

---

## 3. Layout & safe zones

- **Composition:** mark centered, occupying ~62–66% of the canvas
  width. Generous margin so nothing clips when Android/iOS apply their
  circle/squircle masks.
- **Adaptive (Android) safe zone:** all meaningful content inside the
  central **66 dp of the 108 dp** grid (the inner ~⅔). The outer ring
  *will* be cropped on some launchers — keep it background only.
- **No baked-in rounded corners or drop shadows.** Both stores apply
  their own masking and shadow. Deliver full-bleed square art.

---

## 4. Deliverables

| # | Asset | Size | Format | Notes | Repo path |
|---|---|---|---|---|---|
| 1 | **Play Store listing icon** | 512×512 | 32-bit PNG, **opaque** (no alpha), < 1 MB | Full-bleed; Play masks corners. The marketing hero icon. | (upload in Play Console) |
| 2 | **iOS / universal app icon** | 1024×1024 | PNG, **no alpha**, no rounded corners | Apple masks. | `assets/images/icon.png` |
| 3 | **Android adaptive — foreground** | 1024×1024 | PNG **with transparency** | Just the helix mark, centered in the 66% safe zone, transparent elsewhere. | `assets/images/android-icon-foreground.png` |
| 4 | **Android adaptive — background** | 1024×1024 | PNG (opaque) **or** solid color | Cream `#F5F0E6` field (flat color is fine — then we can drop the PNG and set `backgroundColor`). | `assets/images/android-icon-background.png` |
| 5 | **Android monochrome** (themed icons, Android 13+) | 1024×1024 | PNG, transparent, **single color (solid black mark)** | Silhouette of the helix only; the OS recolors it. | `assets/images/android-icon-monochrome.png` |
| 6 | **Splash mark** | 1024×1024 | PNG, transparent | Helix mark only; sits on the splash `backgroundColor`. | `assets/images/splash-icon.png` |
| 7 | **Web favicon** | 48×48 (from 512 master) | PNG | Simplified mark; ensure legible at 16 px. | `assets/images/favicon.png` |

---

## 5. `app.json` changes that follow the new art

Once assets land, update these so the OS chrome matches the brand
(currently teal):

```jsonc
"android": {
  "adaptiveIcon": {
    "backgroundColor": "#F5F0E6",            // was #0A8E83
    "foregroundImage": "./assets/images/android-icon-foreground.png",
    "monochromeImage": "./assets/images/android-icon-monochrome.png"
  }
},
"plugins": [
  ["expo-splash-screen", {
    "image": "./assets/images/splash-icon.png",
    "backgroundColor": "#F5F0E6",            // was #0A8E83
    "dark": { "backgroundColor": "#0E1113" } // ink for dark mode
  }]
]
```
(Leaving the splash dark-mode background as ink `#0E1113` is correct —
that one's already on-brand. Note: `monochromeImage` may need to be
added to the adaptiveIcon block if not already present.)

---

## 6. Do / don't

**Do**
- Keep it flat, engraved, editorial — like a brass stamp on paper.
- Test at 48 px and 24 px before finalizing.
- Deliver opaque PNGs where the table says opaque (Play/iOS reject alpha).

**Don't**
- No text, no Fraunces letters, no "H" lettermark with serifs.
- No teal, no neon, no glossy 3D bevels or long shadows.
- No photographic syringes/vials (off-brand and risks store-policy flags
  for the category).
- No fine 1 px-only details that vanish when masked/scaled.

---

## 7. Acceptance checklist

- [ ] Recognizable silhouette at 48 px
- [ ] Uses only the §1 palette (no teal)
- [ ] Opaque where required (#1, #2); transparent where required (#3, #5, #6)
- [ ] Mark within the 66% adaptive safe zone
- [ ] All 7 assets exported to the listed paths
- [ ] `app.json` backgrounds updated from teal to cream
- [ ] `npm run lint` / build still green after asset swap
