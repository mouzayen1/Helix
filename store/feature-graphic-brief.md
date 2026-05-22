# Helix — Feature Graphic Brief (Google Play, 1024×500)

The feature graphic is the wide banner Google Play shows at the top of your store listing and in promotional spots. It's the first visual a browsing user sees. This brief specifies exactly what to build so it matches the Helix identity and the app icon.

## Hard specs (Google Play requirements)
- **Dimensions:** 1024 × 500 px (exact — no other size accepted)
- **Format:** PNG or JPEG, no transparency
- **Max file size:** 15 MB
- **No important content in the outer ~10% margins** — Google may overlay UI (play button, etc.) on top, especially in the center-bottom where a video play button can appear. Keep text and the logo out of dead-center.
- **No device frames implying it's a different platform**, no excessive text, no "review stars" or fake awards (Google rejects these).

## Brand system (must match icon + landing page)
- **Background:** cream `#F3EDDE` → `#EFE7D6` (same as icon). Optionally a very subtle paper texture, but flat cream is fine and safest.
- **Brass:** `#C9A961` (primary), `#8B6914` (deep), `#A8893F` (mid) — for the helix mark and any accent rules.
- **Ink (text):** near-black `#1A1A1A` or a warm dark `#2B2620`.
- **Typography:**
  - Headline: **Fraunces** (serif), the same display face as the app/landing page. Use the italic for one emphasized word, matching the landing page's "*research notebook*" treatment.
  - Eyebrow/labels: **DM Mono** small-caps, letter-spaced, brass.
  - (If the designer/tool can't embed these exact fonts, closest substitutes: Fraunces → any high-contrast modern serif like Playfair Display; DM Mono → any monospace.)

## Layout (recommended)

```
┌─────────────────────────────────────────────────────────┐
│                                                           │
│   [helix mark]    RESEARCH · EDUCATION · 18+   (DM Mono)  │
│                                                           │
│   The research notebook                                   │
│   for peptide protocols.        (Fraunces, "research"     │
│                                  italic, ink)             │
│                                                           │
│   Monographs · Reconstitution math · Cycle tracking       │
│                                  (DM Mono, brass, small)  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

- **Left third:** the brass helix mark (from the icon — use `helix-foreground-master.svg`), sized ~300px tall, vertically centered.
- **Right two-thirds:** the headline stack.
- Keep everything within the safe area (avoid the outer 100px on each side and the dead-center bottom).

## Copy options (pick one headline)

1. **The *research notebook* for peptide protocols.** ← matches landing page, recommended
2. **Precision tracking for peptide *research*.**
3. **Read the research. *Keep* the record.**

Subline (DM Mono, brass, small caps):
`MONOGRAPHS · RECONSTITUTION MATH · CYCLE & VIAL TRACKING`

Eyebrow (top, DM Mono):
`RESEARCH · EDUCATION · 18+`

## Do / Don't
- ✅ Flat cream background, brass helix, serif headline. Calm, editorial, premium.
- ✅ Lots of negative space. This is a "literary journal" aesthetic, not a loud app banner.
- ✅ One emphasized italic word, max.
- ❌ No screenshots crammed into the banner (screenshots have their own slot).
- ❌ No gradients beyond the subtle cream→cream. No drop shadows on text. No glow.
- ❌ No medical imagery (syringes, pills, molecules-as-clipart), no stock photos.
- ❌ No claims ("#1", "best", "doctor recommended") — false/unverifiable claims get rejected and would be off-brand anyway.

## How to produce it
This is simpler than the icon — it's mostly typesetting on a cream field with the helix mark you already have. Options:
1. **Canva / Figma** — set a 1024×500 frame, cream fill, drop in `helix-foreground-master.svg`, set the Fraunces headline. 15 minutes.
2. **AI image tool** — harder to get crisp text from AI; better to typeset manually since the helix mark already exists.
3. **Hand to the engineer** — they can build it as a static export from the same design tokens; trivial for them.

## Deliverable
- `feature-graphic-1024x500.png` → goes directly into Play Console → Store listing → Graphics → Feature graphic.

## Acceptance checklist
- [ ] Exactly 1024×500
- [ ] Cream background matches icon (`#F3EDDE`)
- [ ] Brass helix mark present, matches app icon
- [ ] Headline in Fraunces (or close serif), legible, ink-colored
- [ ] No content in outer 10% margins or dead-center bottom
- [ ] No fake awards/stars/claims
- [ ] Reads as calm + editorial, consistent with landing page
