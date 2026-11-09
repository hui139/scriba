"""
Builds every icon from the supplied artwork.

Source of truth: assets/logo-source.png (1254x1254, RGB, white outside the plate).
Outputs:
    build/icon.png          1024x1024
    build/icon-512.png       512x512
    build/icon.ico          16, 20, 24, 32, 40, 48, 64, 96, 128, 256
    src/renderer/src/assets/logo.png   256x256 (welcome screen)

The artwork is a rounded plate painted on a white canvas, with no alpha channel.
Windows composites the taskbar icon over whatever colour the taskbar happens to be,
so the white corners have to go: they are flood-filled away from the four corners
(painting them white would show up as pale squares on a dark taskbar).

Downscaling is done in premultiplied alpha. Resizing straight RGBA averages the
colour of fully transparent pixels into the edge, which leaves a halo; premultiplying
first and dividing the alpha back out afterwards avoids it.

Run:  python scripts/build-icons.py
"""
import io
import os
import struct

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "assets", "logo-source.png")

PNG_SIZE = 1024
PNG_512_SIZE = 512
APP_SIZE = 256
ICO_SIZES = (16, 20, 24, 32, 40, 48, 64, 96, 128, 256)

# A pixel counts as backdrop if every channel is at least this bright. The plate's own
# pastels sit around 190-250 per channel with the blue well above the red/green, so the
# min-channel test keeps them out while still catching the antialiased rim.
BACKDROP_MIN = 240

# 1 px in from the flood-filled edge, so the pale rim left by the backdrop's
# antialiasing does not survive as an outline.
ERODE = 1
# A touch of softening keeps the corner from looking stamped after downscaling.
FEATHER = 0.6


def _has_transparency(img: Image.Image) -> bool:
    """True when the image already has pixels that are not fully opaque."""
    if img.mode not in ("RGBA", "LA", "PA"):
        return False
    lo, _hi = img.convert("RGBA").getchannel("A").getextrema()
    return lo < 255


def cut_out_backdrop(img: Image.Image) -> Image.Image:
    """Return `img` as RGBA with the white area outside the plate made transparent."""
    rgb = img.convert("RGB")
    arr = np.asarray(rgb).astype(np.uint8)

    # A pixel is a backdrop candidate when it is bright on every channel. The plate's
    # own pastels have a strong blue offset, so even the very light paper at the bottom
    # of the artwork fails this test and is kept.
    candidate = arr.min(axis=2) >= BACKDROP_MIN

    # Keep only the candidate pixels connected to the canvas border. That is the ring
    # outside the rounded plate. White *inside* the artwork (the bow highlights) is not
    # connected to the border, so it survives untouched.
    outside = np.zeros_like(candidate)
    outside[0, :] = candidate[0, :]
    outside[-1, :] = candidate[-1, :]
    outside[:, 0] |= candidate[:, 0]
    outside[:, -1] |= candidate[:, -1]

    # Iterate until the border-connected region stops growing. The plate is a large
    # convex shape, so it converges in a few hundred passes at 1254 px.
    for _ in range(max(arr.shape[:2])):
        grown = outside.copy()
        grown[1:, :] |= outside[:-1, :]
        grown[:-1, :] |= outside[1:, :]
        grown[:, 1:] |= outside[:, :-1]
        grown[:, :-1] |= outside[:, 1:]
        grown &= candidate
        if np.array_equal(grown, outside):
            break
        outside = grown
    else:
        raise SystemExit("backdrop fill did not converge")

    if not outside.any():
        raise SystemExit("no backdrop found at the canvas border; refusing to guess a mask")

    alpha = np.where(outside, 0, 255).astype(np.uint8)
    alpha_img = Image.fromarray(alpha, mode="L")

    if ERODE:
        alpha_img = alpha_img.filter(ImageFilter.MinFilter(ERODE * 2 + 1))
    if FEATHER:
        alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(FEATHER))

    out = rgb.convert("RGBA")
    out.putalpha(alpha_img)
    return out


def resize_premultiplied(img: Image.Image, size: int) -> Image.Image:
    """Downscale RGBA to `size` x `size` without dragging transparent colour in."""
    if img.size == (size, size):
        return img

    arr = np.asarray(img).astype(np.float32)
    rgb, alpha = arr[:, :, :3], arr[:, :, 3] / 255.0

    channels = []
    for c in range(3):
        premultiplied = rgb[:, :, c] * alpha
        plane = Image.fromarray(premultiplied.astype(np.uint8), mode="L")
        plane = plane.resize((size, size), Image.LANCZOS)
        channels.append(np.asarray(plane).astype(np.float32))

    alpha_plane = Image.fromarray((alpha * 255).astype(np.uint8), mode="L")
    alpha_plane = alpha_plane.resize((size, size), Image.LANCZOS)
    out_alpha = np.asarray(alpha_plane).astype(np.float32)

    out = np.zeros((size, size, 4), dtype=np.float32)
    scale = np.divide(255.0, out_alpha, out=out_alpha.copy(), where=out_alpha > 0)
    for c in range(3):
        out[:, :, c] = np.clip(channels[c] * scale, 0, 255)
    out[:, :, 3] = out_alpha
    return Image.fromarray(out.astype(np.uint8), mode="RGBA")


def build_ico(pngs: dict[int, bytes]) -> bytes:
    """Packs PNG buffers into an .ico. Every entry is stored as PNG, which Vista+ reads."""
    sizes = [s for s in ICO_SIZES if s in pngs]
    header = struct.pack("<HHH", 0, 1, len(sizes))

    directory = bytearray()
    offset = 6 + 16 * len(sizes)
    for size in sizes:
        data = pngs[size]
        # 256 is encoded as 0 in the directory entry.
        dim = 0 if size >= 256 else size
        directory += struct.pack("<BBBBHHII", dim, dim, 0, 0, 1, 32, len(data), offset)
        offset += len(data)

    return header + bytes(directory) + b"".join(pngs[s] for s in sizes)


def png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def main() -> None:
    if not os.path.exists(SOURCE):
        raise SystemExit(f"missing source artwork: {SOURCE}")

    src = Image.open(SOURCE)
    # The supplied artwork is RGB with a white backdrop, so it always needs cutting.
    # Only skip the cut when a future source already carries real transparency.
    if not _has_transparency(src):
        src = cut_out_backdrop(src)
    else:
        src = src.convert("RGBA")

    build_dir = os.path.join(ROOT, "build")
    os.makedirs(build_dir, exist_ok=True)

    big = resize_premultiplied(src, PNG_SIZE)
    big.save(os.path.join(build_dir, "icon.png"))
    print(f"icon.png: {big.size}")

    mid = resize_premultiplied(src, PNG_512_SIZE)
    mid.save(os.path.join(build_dir, "icon-512.png"))
    print(f"icon-512.png: {mid.size}")

    pngs = {size: png_bytes(resize_premultiplied(src, size)) for size in ICO_SIZES}
    ico = build_ico(pngs)
    with open(os.path.join(build_dir, "icon.ico"), "wb") as fh:
        fh.write(ico)
    print("icon.ico: " + ", ".join(str(s) for s in ICO_SIZES))

    app_asset_dir = os.path.join(ROOT, "src", "renderer", "src", "assets")
    os.makedirs(app_asset_dir, exist_ok=True)
    app_icon = resize_premultiplied(src, APP_SIZE)
    app_icon.save(os.path.join(app_asset_dir, "logo.png"))
    print(f"src/renderer/src/assets/logo.png: {app_icon.size}")


if __name__ == "__main__":
    main()
