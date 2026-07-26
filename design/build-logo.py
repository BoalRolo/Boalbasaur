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
SOURCE = ROOT / "design/uploads/logo-source.png"

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
            target[x, y] = green + (round(alpha * 255),)
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
