#!/usr/bin/env python3
"""
Generate the favicon / touch-icon / tile / Open Graph set from the project's own
logo, so `src/components/SeoHead.astro` references real files instead of assets
that do not exist.

    python3 scripts/generate-brand-assets.py

Idempotent — re-running overwrites with identical output for the same logo.

Input : public/aib-assets/AIB_Logo.png  (1200x1200 RGBA, fully transparent)
Output: public/favicon.ico, favicon-16x16.png, favicon-32x32.png,
        apple-touch-icon.png, mstile-150x150.png, og-image.png

Why the logo is composited rather than used raw: it is fully transparent, and a
transparent `og:image` renders on whatever colour the consumer's background
happens to be. The tile/icons get the AIB brand gradient so they read correctly
in a browser tab and on a Windows tile.

NOT wired into `prebuild`: it needs Pillow, which is not guaranteed to exist on
the Vercel build image. The generated files are committed; run this by hand
after replacing the logo. The Node audit `scripts/audit-crawler-seo.mjs` fails
the build if any referenced icon is missing, which is the guard that matters.
"""

from __future__ import annotations

import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover
    sys.exit("Pillow is required: python3 -m pip install Pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
SRC_LOGO = os.path.join(PUBLIC, "aib-assets", "AIB_Logo.png")

# AIB brand gradient endpoints, matching the landing logo tile
# (`linear-gradient(45deg,#512d6d 0%,#c42f9e 80%)`).
GRADIENT_FROM = (81, 45, 109)
GRADIENT_TO = (196, 47, 158)

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]


def gradient(size: int, horizontal: bool = False) -> Image.Image:
    """Linear gradient across `size`, matching the landing's 45deg brand tile."""
    base = Image.new("RGB", (size, size), GRADIENT_FROM)
    draw = ImageDraw.Draw(base)
    steps = size if horizontal else size
    for i in range(steps):
        t = i / max(steps - 1, 1)
        # 45deg: horizontal advance dominates, vertical follows at 80%
        colour = (
            round(GRADIENT_FROM[0] + (GRADIENT_TO[0] - GRADIENT_FROM[0]) * t),
            round(GRADIENT_FROM[1] + (GRADIENT_TO[1] - GRADIENT_FROM[1]) * t),
            round(GRADIENT_FROM[2] + (GRADIENT_TO[2] - GRADIENT_FROM[2]) * t),
        )
        if horizontal:
            draw.line([(i, 0), (i, size)], fill=colour)
        else:
            draw.line([(0, i), (size, i)], fill=colour)
    return base


def load_font(size: int):
    for candidate in FONT_CANDIDATES:
        if os.path.exists(candidate):
            try:
                return ImageFont.truetype(candidate, size)
            except OSError:
                continue
    return ImageFont.load_default()


def centered_logo(canvas: Image.Image, logo: Image.Image, box: int) -> Image.Image:
    """Scale `logo` to fit a `box`x`box` square and paste it centred."""
    inner = max(int(box * 0.62), 1)
    resized = logo.resize((inner, inner), Image.LANCZOS)
    offset = ((canvas.width - inner) // 2, (canvas.height - inner) // 2)
    canvas.paste(resized, offset, resized)
    return canvas


def square_icon(size: int) -> Image.Image:
    canvas = gradient(size)
    return centered_logo(canvas, LOGO, size)


def favicon_ico(sizes=(16, 32, 48)) -> None:
    frames = [square_icon(s).convert("RGBA") for s in sizes]
    frames[0].save(
        os.path.join(PUBLIC, "favicon.ico"),
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=frames[1:],
    )


def og_image(width: int = 1200, height: int = 630) -> None:
    """1200x630 social card: brand gradient, logo left, brand wordmark right."""
    base = gradient(width, horizontal=True).convert("RGBA")
    draw = ImageDraw.Draw(base)

    sub2 = "Registration number and Personal Access Code"
    sub1 = "Online banking login"
    brand = "AIB"

    # Fit the text column, then fit the whole group (logo + text) to the card.
    pad = int(width * 0.07)
    gap = int(width * 0.045)
    logo_px = int(height * 0.52)
    text_max = width - pad * 2 - logo_px - gap

    def fit(text: str, start: int):
        size = start
        while size > 10:
            font = load_font(size)
            box = draw.textbbox((0, 0), text, font=font)
            if box[2] - box[0] <= text_max:
                return font, box
            size -= 2
        font = load_font(10)
        return font, draw.textbbox((0, 0), text, font=font)

    brand_font, brand_box = fit(brand, int(height * 0.155))
    sub1_font, sub1_box = fit(sub1, int(height * 0.072))
    sub2_font, sub2_box = fit(sub2, int(height * 0.055))

    def h(box):
        return box[3] - box[1]

    def w(box):
        return box[2] - box[0]

    gap1 = int(height * 0.04)
    gap2 = int(height * 0.022)
    text_h = h(brand_box) + gap1 + h(sub1_box) + gap2 + h(sub2_box)
    text_w = max(w(brand_box), w(sub1_box), w(sub2_box))
    group_h = max(logo_px, text_h)
    group_w = logo_px + gap + text_w

    logo = LOGO.resize((logo_px, logo_px), Image.LANCZOS)
    logo_x = max(pad, (width - group_w) // 2)
    logo_y = (height - group_h) // 2
    base.paste(logo, (logo_x, logo_y), logo)

    text_x = logo_x + logo_px + gap
    y = logo_y + (group_h - text_h) // 2
    draw.text((text_x, y - brand_box[1]), brand, font=brand_font, fill=(255, 255, 255, 255))
    y += h(brand_box) + gap1
    draw.text((text_x, y - sub1_box[1]), sub1, font=sub1_font, fill=(255, 255, 255, 238))
    y += h(sub1_box) + gap2
    draw.text((text_x, y - sub2_box[1]), sub2, font=sub2_font, fill=(255, 255, 255, 205))

    base.convert("RGB").save(os.path.join(PUBLIC, "og-image.png"), format="PNG", optimize=True)


def main() -> None:
    global LOGO
    if not os.path.exists(SRC_LOGO):
        sys.exit(f"missing source logo: {SRC_LOGO}")
    LOGO = Image.open(SRC_LOGO).convert("RGBA")

    favicon_ico()
    square_icon(16).save(os.path.join(PUBLIC, "favicon-16x16.png"), format="PNG", optimize=True)
    square_icon(32).save(os.path.join(PUBLIC, "favicon-32x32.png"), format="PNG", optimize=True)
    square_icon(180).save(os.path.join(PUBLIC, "apple-touch-icon.png"), format="PNG", optimize=True)
    square_icon(150).save(os.path.join(PUBLIC, "mstile-150x150.png"), format="PNG", optimize=True)
    og_image()

    for name in (
        "favicon.ico",
        "favicon-16x16.png",
        "favicon-32x32.png",
        "apple-touch-icon.png",
        "mstile-150x150.png",
        "og-image.png",
    ):
        p = os.path.join(PUBLIC, name)
        print(f"{name:24s} {os.path.getsize(p):>8,} bytes")


if __name__ == "__main__":
    main()