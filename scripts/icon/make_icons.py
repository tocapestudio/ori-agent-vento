"""Builds Ori app icons (favicon, apple-touch, header logo, multi-size .ico) from the approved source image."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
PUB = HERE.parent.parent / "frontend" / "public"
SRC = Image.open(HERE / "source.png").convert("RGB")
WIDE = (222, 14, 812, 604)   # head + antenna + raised nub
TIGHT = (236, 70, 836, 670)  # head + nub, for 16-32 px


def tile(size, box, rounded=True):
    art = SRC.crop(box).resize((size, size), Image.LANCZOS)
    if size <= 32:
        art = art.filter(ImageFilter.UnsharpMask(radius=1, percent=120, threshold=2))
    if not rounded:
        return art
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = Image.new("L", (size * 4, size * 4), 0)
    r = int(size * 4 * 0.22)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), r, fill=255)
    out.paste(art, (0, 0), mask.resize((size, size), Image.LANCZOS))
    border = Image.new("RGBA", (size * 4, size * 4), (0, 0, 0, 0))
    ImageDraw.Draw(border).rounded_rectangle((2, 2, size * 4 - 3, size * 4 - 3), r, outline=(203, 213, 225, 255), width=max(3, size // 16))
    return out if size < 48 else Image.alpha_composite(out, border.resize((size, size), Image.LANCZOS))


if __name__ == "__main__":
    sizes = [16, 24, 32, 48, 64, 128, 256]
    imgs = {s: tile(s, TIGHT if s <= 32 else WIDE) for s in sizes}
    imgs[256].save(PUB / "ori.ico", sizes=[(s, s) for s in sizes], append_images=[imgs[s] for s in sizes[:-1]])
    tile(192, WIDE).save(PUB / "favicon.png")
    tile(256, WIDE).save(PUB / "ori-icon.png")
    tile(180, WIDE, rounded=False).save(PUB / "apple-touch-icon.png")
    preview = Image.new("RGBA", (16 * 8 + 32 * 8 + 48 * 4 + 40, 260), (255, 255, 255, 255))
    x = 10
    for s, k in ((16, 8), (32, 8), (48, 4)):
        preview.paste(imgs[s].resize((s * k, s * k), Image.NEAREST), (x, 2), imgs[s].resize((s * k, s * k), Image.NEAREST))
        x += s * k + 10
    preview.save(HERE / "preview_small_v2.png")
    dark = Image.new("RGBA", (200, 60), (32, 32, 32, 255))
    for i, s in enumerate((16, 24, 32, 48)):
        dark.paste(imgs[s], (10 + i * 45, 6), imgs[s])
    dark.save(HERE / "preview_taskbar_v2.png")
    print("ok")
