#!/usr/bin/env python3
"""Build the site logo from the uploaded artwork.

    python3 design/build-logo.py

The source is flat green on opaque white. Rather than key the white out on a
threshold — which leaves a pale halo on every anti-aliased edge — this solves
the blend the artwork was drawn with. Each pixel is green over white:

    pixel = green * a + 255 * (1 - a)   =>   a = (255 - pixel) / (255 - green)

so alpha comes back exactly, edges included, and the gaps between the petals
become transparent instead of white.

Writes assets/logo.png (trimmed, for the header) and assets/favicon.png
(padded square, for the tab). Requires Pillow.
"""

import pathlib
from collections import Counter

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "design/uploads/logo2.png"

# The artwork's own green is #82AB3C, which is only 2.47:1 against the page
# background — light for a brand mark. Refilled with the deeper green the mark
# has always been drawn in, which lands at 5.43:1.
# Set to None to keep whatever green the source was drawn in.
FILL = (0x3F, 0x6F, 0x44)

FAVICON_SIZE = 128
FAVICON_PADDING = 6  # px of clear space per side, so it doesn't touch the edge


def keyed_out(image):
    """Green-on-white artwork -> the same green on transparency."""
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()

    # The artwork's green: the most common non-white colour, i.e. the flat fill.
    # Not the darkest pixel — a single noisy sample down there would be read as
    # the fill colour and leave the whole interior semi-transparent.
    counts = Counter(
        pixels[x, y][:3]
        for y in range(height)
        for x in range(width)
        if sum(pixels[x, y][:3]) < 720 and pixels[x, y][3] > 0
    )
    green = counts.most_common(1)[0][0]
    spans = [255 - c for c in green]
    # The alpha solve needs the green the artwork was actually drawn in; the
    # colour it gets painted back in is a separate decision.
    fill = FILL or green

    out = Image.new("RGBA", (width, height))
    target = out.load()
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            # Average the three per-channel estimates; on a clean two-colour
            # blend they agree, and averaging shrugs off compression noise.
            alpha = sum(
                (255 - c) / span for c, span in zip((r, g, b), spans) if span
            ) / sum(1 for span in spans if span)
            alpha = max(0.0, min(1.0, alpha)) * (a / 255)
            # logo2's "white" is 253-254, not 255, so the margin solves to
            # alpha 2-4 rather than 0 — invisible, but enough to defeat the
            # getbbox() trim below and to tint a dark backdrop. Anything under
            # 3% is that noise floor, never a real anti-aliased edge.
            if alpha < 0.03:
                alpha = 0.0
            target[x, y] = fill + (round(alpha * 255),)
    return out


def main():
    logo = keyed_out(Image.open(SOURCE))

    bbox = logo.getbbox()  # trim the transparent margin
    logo = logo.crop(bbox)
    logo.save(ROOT / "assets/logo.png")

    inner = FAVICON_SIZE - FAVICON_PADDING * 2
    scaled = logo.copy()
    scaled.thumbnail((inner, inner), Image.LANCZOS)

    favicon = Image.new("RGBA", (FAVICON_SIZE, FAVICON_SIZE), (0, 0, 0, 0))
    favicon.paste(
        scaled,
        ((FAVICON_SIZE - scaled.width) // 2, (FAVICON_SIZE - scaled.height) // 2),
        scaled,
    )
    favicon.save(ROOT / "assets/favicon.png")

    print(f"logo.png     {logo.width}x{logo.height}")
    print(f"favicon.png  {FAVICON_SIZE}x{FAVICON_SIZE}")


if __name__ == "__main__":
    main()
