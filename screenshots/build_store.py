#!/usr/bin/env python3
"""Build Play Store marketing screenshots from real device captures.

Strips the Android status bar (top) + system nav bar (bottom) from each
1080x2520 capture, then composes the clean app screen onto a branded cream
canvas (matching the app's editorial palette) with a Fraunces headline.
Output: 1242x2208 (9:16), opaque RGB PNG.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

U = "/root/.claude/uploads/f6f3fb25-7f3e-45b1-9a96-bc943248628e"
OUT = "/home/user/Helix/store/screenshots"
FONTS = "/home/user/Helix/node_modules/@expo-google-fonts"

# palette (sampled from the app)
CREAM = (244, 240, 229)
INK = (43, 38, 32)
BRASS = (139, 104, 20)
SUB = (122, 112, 96)

F_SEMI = f"{FONTS}/fraunces/600SemiBold/Fraunces_600SemiBold.ttf"
F_ITAL = f"{FONTS}/fraunces/400Regular_Italic/Fraunces_400Regular_Italic.ttf"
F_MONO = f"{FONTS}/dm-mono/500Medium/DMMono_500Medium.ttf"

CANVAS_W, CANVAS_H = 1242, 2208
CROP_TOP, CROP_BOT = 86, 2386  # rows to keep from the 1080x2520 source

# screen -> (file, eyebrow, line1 (semibold), line2 (italic))
SHOTS = [
    ("f347b455-36782.jpg", "DAILY SCHEDULE", "Every dose,", "every morning."),
    ("768cd4d0-36784.jpg", "THE CATALOG", "43 peptides.", "Sourced & honest."),
    ("d5e23f20-36786.jpg", "MONOGRAPHS", "Depth, not", "bro-science."),
    ("fede21f1-36792.jpg", "CYCLES", "Run protocols", "with precision."),
    ("a0ff9ada-36796.jpg", "PROGRESS", "Watch your", "trends emerge."),
    ("cd5977af-36799.jpg", "METRICS", "Numbers that", "mean something."),
]
NAMES = ["today", "library", "peptide", "cycle", "progress", "weight"]


def tracked_text(draw, xy, text, font, fill, tracking):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking
    return x


def rounded_shadow(size, radius, blur, alpha):
    w, h = size
    pad = blur * 3
    sh = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(sh)
    d.rounded_rectangle([pad, pad, pad + w, pad + h], radius=radius,
                        fill=(30, 24, 16, alpha))
    return sh.filter(ImageFilter.GaussianBlur(blur)), pad


def build(src, eyebrow, l1, l2, out_path):
    cap = Image.open(os.path.join(U, src)).convert("RGB")
    cap = cap.crop((0, CROP_TOP, cap.width, CROP_BOT))  # strip OS chrome

    canvas = Image.new("RGB", (CANVAS_W, CANVAS_H), CREAM)
    draw = ImageDraw.Draw(canvas)

    # --- headline block ---
    eb_font = ImageFont.truetype(F_MONO, 27)
    h1 = ImageFont.truetype(F_SEMI, 76)
    h2 = ImageFont.truetype(F_ITAL, 76)
    mx = 96
    tracked_text(draw, (mx, 104), eyebrow, eb_font, BRASS, 6)
    draw.text((mx, 150), l1, font=h1, fill=INK)
    draw.text((mx, 150 + 92), l2, font=h2, fill=INK)
    head_bottom = 150 + 92 + 96

    # --- phone screen ---
    avail_top = head_bottom + 40
    avail_h = CANVAS_H - avail_top - 70
    scale = avail_h / cap.height
    pw, ph = int(cap.width * scale), int(cap.height * scale)
    if pw > CANVAS_W - 150:  # don't overflow width
        scale = (CANVAS_W - 150) / cap.width
        pw, ph = int(cap.width * scale), int(cap.height * scale)
    phone = cap.resize((pw, ph), Image.LANCZOS)

    radius = 46
    mask = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, pw, ph], radius=radius, fill=255)

    px = (CANVAS_W - pw) // 2
    py = avail_top + (avail_h - ph) // 2

    shadow, pad = rounded_shadow((pw, ph), radius, 34, 70)
    canvas.paste((30, 24, 16), (0, 0), Image.new("L", (1, 1)))  # noop guard
    canvas.paste(shadow, (px - pad, py - pad + 16), shadow)
    canvas.paste(phone, (px, py), mask)
    # hairline bezel
    ImageDraw.Draw(canvas).rounded_rectangle(
        [px, py, px + pw, py + ph], radius=radius, outline=(214, 206, 188), width=2)

    canvas.save(out_path, "PNG")
    return canvas.size


os.makedirs(OUT, exist_ok=True)
for (src, eb, l1, l2), name in zip(SHOTS, NAMES):
    p = os.path.join(OUT, f"{name}.png")
    sz = build(src, eb, l1, l2, p)
    print(f"{name}.png  {sz[0]}x{sz[1]}  ratio={sz[0]/sz[1]:.4f}")
print("done")
