"""Draws the Android app icon and splash images from Lumi's logo (frontend/public/lumi.svg).

Run from the repo root after changing the logo or colors:  python scripts/android_icons.py
Needs Pillow. Writes into frontend/android/app/src/main/res (see docs/09-android-app.md).
The shapes below copy lumi.svg (viewBox 0 0 64 64); keep them in step with it.
"""
from pathlib import Path

from PIL import Image, ImageDraw

RES = Path(__file__).resolve().parent.parent / "frontend/android/app/src/main/res"
ICON_BG = "#8B5CF6"  # violet, the Teach Lumi button color
SPLASH_BG = "#FDF8EE"  # the app's cream page color
SS = 4  # supersampling for smooth edges
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def _quad(p0, p1, p2, n=24):
    return [
        ((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
         (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])
        for t in (i / n for i in range(n + 1))
    ]


def draw_lumi(img: Image.Image, cx: float, cy: float, size: float) -> None:
    """Draws the 64-unit logo centered at (cx, cy), `size` pixels wide."""
    d = ImageDraw.Draw(img)
    k = size / 64
    ox, oy = cx - 32 * k, cy - 32 * k
    P = lambda x, y: (ox + x * k, oy + y * k)  # noqa: E731
    w = lambda v: max(1, round(v * k))  # noqa: E731

    def rrect(x, y, ww, hh, r, fill, outline=None, width=0):
        d.rounded_rectangle([P(x, y), P(x + ww, y + hh)], radius=r * k, fill=fill, outline=outline, width=w(width) if outline else 0)

    def roundline(points, color, width):
        d.line(points, fill=color, width=w(width), joint="curve")
        for x, y in (points[0], points[-1]):
            r = width * k / 2
            d.ellipse([x - r, y - r, x + r, y + r], fill=color)

    roundline([P(32, 9), P(32, 4)], "#C7D6DE", 2.5)  # antenna
    d.ellipse([P(28.5, 1), P(35.5, 8)], fill="#FFB347")
    rrect(3, 24, 6, 16, 3, "#4FC3C7")  # ears
    rrect(55, 24, 6, 16, 3, "#4FC3C7")
    rrect(6, 9, 52, 46, 21, "#F4F8FA", "#C7D6DE", 1.5)  # head
    rrect(12, 15, 40, 33, 14, "#0F2D3D")  # face screen
    d.ellipse([P(19.5, 24.5), P(28.5, 35.5)], fill="#6FE7EC")  # eyes
    d.ellipse([P(35.5, 24.5), P(44.5, 35.5)], fill="#6FE7EC")
    roundline(_quad(P(26, 39), P(32, 43), P(38, 39)), "#6FE7EC", 2.2)  # smile


def render(px: int, bg: str | None, logo_frac: float, shape: str = "square") -> Image.Image:
    big = px * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    if bg:
        d = ImageDraw.Draw(img)
        if shape == "circle":
            d.ellipse([0, 0, big - 1, big - 1], fill=bg)
        elif shape == "rounded":
            d.rounded_rectangle([0, 0, big - 1, big - 1], radius=big * 0.22, fill=bg)
        else:
            d.rectangle([0, 0, big, big], fill=bg)
    draw_lumi(img, big / 2, big / 2 + big * 0.02, big * logo_frac)
    return img.resize((px, px), Image.LANCZOS)


def main() -> None:
    for name, scale in DENSITIES.items():
        folder = RES / f"mipmap-{name}"
        # Adaptive icon foreground: 108 dp canvas, logo inside the 66 dp safe zone.
        render(round(108 * scale), None, 0.5).save(folder / "ic_launcher_foreground.png")
        # Legacy icons (before Android 8): 48 dp.
        render(round(48 * scale), ICON_BG, 0.72, "rounded").save(folder / "ic_launcher.png")
        render(round(48 * scale), ICON_BG, 0.68, "circle").save(folder / "ic_launcher_round.png")

    # Splash images (shown before Android 12, and behind the web view while it loads): cream page, Lumi centered.
    for splash in RES.glob("drawable*/splash.png"):
        w, h = Image.open(splash).size
        img = Image.new("RGBA", (w * SS, h * SS), SPLASH_BG)
        draw_lumi(img, w * SS / 2, h * SS / 2, min(w, h) * SS * 0.28)
        img.resize((w, h), Image.LANCZOS).save(splash)

    bg = RES / "values/ic_launcher_background.xml"
    bg.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        f'    <color name="ic_launcher_background">{ICON_BG}</color>\n'
        f'    <color name="lumi_splash_background">{SPLASH_BG}</color>\n</resources>\n',
        encoding="utf-8",
    )
    print("icons and splash written to", RES)


if __name__ == "__main__":
    main()
