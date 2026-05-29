"""Render PWA icons at 192 and 512 from the SVG design (no SVG renderer required)."""
from PIL import Image, ImageDraw

ICON_BG = (13, 17, 23)
ICON_BG_INNER = (22, 27, 34)
ACCENT = (245, 158, 11)
BLUE = (59, 130, 246)


def render(size, out_path, maskable_pad=0.0):
    img = Image.new("RGBA", (size, size), ICON_BG)
    draw = ImageDraw.Draw(img)

    scale = size / 512
    inset = int(size * maskable_pad)
    s = size - inset * 2
    cx = size // 2
    cy = size // 2

    radius = int(96 * scale)
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    bg_draw.rounded_rectangle([inset, inset, size - inset, size - inset], radius=radius, fill=ICON_BG)
    img.paste(bg, (0, 0), bg)
    draw = ImageDraw.Draw(img)

    def sx(x):
        return int(inset + (x / 512) * s)

    def sy(y):
        return int(inset + (y / 512) * s)

    stroke_w = max(2, int(6 * scale * (s / size)))

    diamond = [(sx(256), sy(96)), (sx(416), sy(256)), (sx(256), sy(416)), (sx(96), sy(256))]
    draw.polygon(diamond, outline=ACCENT, fill=None, width=stroke_w)
    draw.line([(sx(256), sy(96)), (sx(256), sy(416))], fill=ACCENT, width=stroke_w)
    draw.line([(sx(96), sy(256)), (sx(416), sy(256))], fill=ACCENT, width=stroke_w)

    for (x, y, r) in [(256, 96, 22), (416, 256, 22), (256, 416, 22), (96, 256, 22), (256, 256, 28)]:
        rr = max(2, int(r * scale * (s / size)))
        cx_, cy_ = sx(x), sy(y)
        draw.ellipse([cx_ - rr, cy_ - rr, cx_ + rr, cy_ + rr], fill=ACCENT)

    for (x, y) in [(176, 176), (336, 176), (176, 336), (336, 336)]:
        rr = max(2, int(14 * scale * (s / size)))
        cx_, cy_ = sx(x), sy(y)
        draw.ellipse([cx_ - rr, cy_ - rr, cx_ + rr, cy_ + rr], fill=BLUE)

    img.save(out_path, "PNG", optimize=True)
    print(f"  wrote {out_path}")


if __name__ == "__main__":
    import os
    out_dir = os.path.join(os.path.dirname(__file__), "..", "assets", "icons")
    os.makedirs(out_dir, exist_ok=True)
    render(192, os.path.join(out_dir, "icon-192.png"))
    render(512, os.path.join(out_dir, "icon-512.png"))
    render(192, os.path.join(out_dir, "icon-192-maskable.png"), maskable_pad=0.10)
    render(512, os.path.join(out_dir, "icon-512-maskable.png"), maskable_pad=0.10)
    render(180, os.path.join(out_dir, "apple-touch-icon.png"))
    print("done.")
