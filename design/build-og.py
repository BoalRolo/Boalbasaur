#!/usr/bin/env python3
"""Build the link-preview image.

    python3 design/build-og.py

Writes assets/og.png at 1200x630 — the size WhatsApp, Threads, Slack, iMessage
and the rest crop to. Composes the existing logo over the site's own background
gradient, so a shared link looks like the page it opens. Requires Pillow.
"""

import pathlib

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent

WIDTH, HEIGHT = 1200, 630

# The body gradient's stops, sampled from styles.css and converted to sRGB.
TOP = (238, 247, 236)
BOTTOM = (232, 245, 234)

INK = (26, 29, 36)
GREEN = (35, 105, 62)
MUTED = (93, 100, 111)

LOGO_HEIGHT = 132
MARGIN = 96

# Space Grotesk isn't installed system-wide; fall back through what macOS has.
FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Futura.ttc",
    "/System/Library/Fonts/Avenir Next.ttc",
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/System/Library/Fonts/Helvetica.ttc",
]


def load_font(size, index=0):
    for path in FONT_CANDIDATES:
        if pathlib.Path(path).exists():
            try:
                return ImageFont.truetype(path, size, index=index)
            except OSError:
                continue
    return ImageFont.load_default()


def background():
    canvas = Image.new("RGB", (WIDTH, HEIGHT), TOP)
    draw = ImageDraw.Draw(canvas)
    for y in range(HEIGHT):
        t = y / (HEIGHT - 1)
        draw.line(
            [(0, y), (WIDTH, y)],
            fill=tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOTTOM)),
        )
    return canvas


def main():
    canvas = background()

    logo = Image.open(ROOT / "assets/logo.png").convert("RGBA")
    logo.thumbnail((LOGO_HEIGHT * 2, LOGO_HEIGHT), Image.LANCZOS)
    canvas.paste(logo, (MARGIN, MARGIN), logo)

    draw = ImageDraw.Draw(canvas)

    wordmark = load_font(62)
    draw.text((MARGIN + logo.width + 28, MARGIN + logo.height // 2),
              "boalbasaur", font=wordmark, fill=INK, anchor="lm")

    headline = load_font(92)
    draw.text((MARGIN, 286), "Things I've grown,", font=headline, fill=INK)
    draw.text((MARGIN, 392), "laid out properly.", font=headline, fill=GREEN)

    # Placed off the second line's actual ink, not a guessed offset — the
    # descenders of "properly." reach well below the nominal baseline.
    _, _, _, headline_bottom = draw.textbbox((MARGIN, 392), "laid out properly.",
                                             font=headline)
    tagline = load_font(34)
    draw.text((MARGIN, headline_bottom + 34),
              "Projects, and the story behind each one.",
              font=tagline, fill=MUTED)

    canvas.save(ROOT / "assets/og.png")
    print(f"og.png  {WIDTH}x{HEIGHT}")


if __name__ == "__main__":
    main()
