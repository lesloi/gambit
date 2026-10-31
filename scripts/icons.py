"""Regenerates the PWA icons from the same pawn as `public/favicon.svg`.

Run with `python3 scripts/icons.py` from the repository root. Pillow is the only
requirement; the generated files are committed so a build needs no Python.
"""

from pathlib import Path

from PIL import Image, ImageDraw

PAPER = "#f7f3ea"
ACCENT = "#b4552d"
SCALE = 4
ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"


def pawn(size: int, bleed: bool) -> Image.Image:
    image = Image.new("RGB", (size * SCALE, size * SCALE), PAPER)
    draw = ImageDraw.Draw(image)

    # A maskable icon keeps its artwork inside the safe zone, so it gets more padding.
    padding = size * (0.12 if bleed else 0.16)
    unit = (size - 2 * padding) / 64
    origin = padding * SCALE

    def at(x: float, y: float) -> tuple[float, float]:
        return (origin + x * unit * SCALE, origin + y * unit * SCALE)

    draw.ellipse((*at(24, 13), *at(40, 29)), fill=ACCENT)
    draw.polygon([at(27, 27), at(37, 27), at(40, 41), at(24, 41)], fill=ACCENT)
    draw.rounded_rectangle((*at(21, 40), *at(43, 48)), radius=4 * unit * SCALE, fill=ACCENT)

    return image.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    for name, size, bleed in (
        ("pwa-192.png", 192, False),
        ("pwa-512.png", 512, False),
        ("pwa-maskable-512.png", 512, True),
        ("apple-touch-icon.png", 180, True),
    ):
        pawn(size, bleed).save(PUBLIC / name, optimize=True)
        print(f"wrote public/{name}")


if __name__ == "__main__":
    main()
