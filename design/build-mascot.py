#!/usr/bin/env python3
"""Regenerate the mascot assets from the design upload.

    python3 design/build-mascot.py

Writes assets/mascot.png (header avatar, favicon) and assets/mascot-hero.png
(the hero disc). Requires Pillow.
"""

import pathlib

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "design/uploads/pasted-1785025054855-0.png"

# The source art carries a 3px black fringe down its right edge, left over from
# the screenshot it was cropped out of. Invisible while the image over-covered
# its frame, obvious the moment it doesn't.
FRINGE_RIGHT = 3

# Face span as a share of the hero canvas. With the hero disc at 96px and the
# image scaled 1.18 in CSS, 0.75 puts the face at ~85px, between the original
# art (which overflowed the disc at ~101px) and the first pass at ~74px.
FACE_FRACTION = 0.75

# How close a pixel must be to the corner colour to count as background.
BG_TOLERANCE = 6


def face_bounds(image, background):
    pixels = image.load()
    width, height = image.size

    def is_background(pixel):
        return all(abs(a - b) <= BG_TOLERANCE for a, b in zip(pixel[:3], background))

    xs = [x for x in range(width) for y in range(0, height, 2)
          if not is_background(pixels[x, y])]
    ys = [y for y in range(height) for x in range(0, width, 2)
          if not is_background(pixels[x, y])]
    return min(xs), min(ys), max(xs), max(ys)


def main():
    source = Image.open(SOURCE)
    icc = source.info.get("icc_profile")

    art = source.convert("RGBA")
    art = art.crop((0, 0, art.width - FRINGE_RIGHT, art.height))
    background = art.load()[0, 0][:3]

    art.save(ROOT / "assets/mascot.png", icc_profile=icc)

    x0, y0, x1, y1 = face_bounds(art, background)
    face_w, face_h = x1 - x0 + 1, y1 - y0 + 1

    side = round(max(face_w, face_h) / FACE_FRACTION)
    canvas = Image.new("RGBA", (side, side), background + (255,))
    canvas.paste(art, (round((side - face_w) / 2) - x0,
                       round((side - face_h) / 2) - y0), art)
    canvas.save(ROOT / "assets/mascot-hero.png", icc_profile=icc)

    print(f"mascot.png       {art.width}x{art.height}")
    print(f"mascot-hero.png  {side}x{side} (face {face_w}x{face_h})")


if __name__ == "__main__":
    main()
