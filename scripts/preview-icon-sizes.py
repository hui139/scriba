"""
Renders a magnification sheet of the small icon sizes.

Windows renders the taskbar icon from the 16-32 px entries of build/icon.ico, so that
is where an app mark lives or dies. This script pulls those entries back out of the
ICO, scales them up with nearest-neighbour (no smoothing, so you see the real pixels),
and lays them on both a dark and a light background.

Run after regenerating the icons:
    python scripts/preview-icon-sizes.py
Writes docs/images/icon-sizes.png.
"""
import io
import os
import struct

from PIL import Image

SIZES = (16, 20, 24, 32, 48, 256)
TILE = 200          # every tile is scaled to roughly this many pixels wide
PAD = 20


def scale_for(size: int) -> int:
    """Nearest-neighbour factor that brings `size` up to about TILE pixels."""
    return max(1, round(TILE / size))


def load_entries(path: str) -> dict[int, Image.Image]:
    data = open(path, "rb").read()
    _, _, count = struct.unpack_from("<HHH", data, 0)
    out = {}
    for i in range(count):
        off = 6 + i * 16
        w, _h, _cc, _res, _planes, _bpp, size, offset = struct.unpack_from("<BBBBHHII", data, off)
        w = w or 256
        if w in SIZES:
            out[w] = Image.open(io.BytesIO(data[offset:offset + size])).convert("RGBA")
    return out


def main() -> None:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    entries = load_entries(os.path.join(root, "build", "icon.ico"))

    missing = [s for s in SIZES if s not in entries]
    if missing:
        raise SystemExit(f"icon.ico is missing sizes: {missing}")

    tiles = []
    for size in SIZES:
        factor = scale_for(size)
        tiles.append(entries[size].resize((size * factor, size * factor), Image.NEAREST))

    width = sum(t.width for t in tiles) + PAD * (len(tiles) + 1)
    height = max(t.height for t in tiles) + PAD * 2

    strip = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    x = PAD
    for tile in tiles:
        # Align the tiles along their bottom edge so the sizes read as a row.
        strip.alpha_composite(tile, (x, PAD + (height - PAD * 2) - tile.height))
        x += tile.width + PAD

    dark = Image.new("RGBA", strip.size, (32, 34, 40, 255))
    dark.alpha_composite(strip)
    light = Image.new("RGBA", strip.size, (243, 244, 246, 255))
    light.alpha_composite(strip)

    sheet = Image.new("RGBA", (width, height * 2 + 8), (255, 255, 255, 255))
    sheet.paste(dark, (0, 0))
    sheet.paste(light, (0, height + 8))

    out_dir = os.path.join(root, "docs", "images")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "icon-sizes.png")
    sheet.convert("RGB").save(out)
    print(f"wrote {out} ({width}x{height * 2 + 8}) sizes={list(SIZES)}")


if __name__ == "__main__":
    main()
