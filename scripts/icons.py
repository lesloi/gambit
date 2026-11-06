"""Regenerates the PWA icons from the same rook as `public/favicon.svg`.

Run with `python3 scripts/icons.py` from the repository root. Pillow is the only
requirement; the generated files are committed so a build needs no Python.
"""

from pathlib import Path

from PIL import Image, ImageDraw

INK = "#1c1a18"
CREAM = "#f7f3ea"
SUPERSAMPLE = 4
ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

# The rook, in the 512-unit grid of `public/favicon.svg`. Every coordinate below
# is copied from it: change both or the tab and the installed app diverge.
CRENEAUX = [
    (136, 96), (200, 96), (200, 162), (224, 162), (224, 96), (288, 96),
    (288, 162), (312, 162), (312, 96), (376, 96), (376, 168), (136, 168),
]
CORPS = [(152, 202), (360, 202), (344, 338), (168, 338)]
# (x0, y0, x1, y1, radius)
PLATEAUX = [
    (124, 168, 380, 202, 6),
    (140, 338, 372, 368, 4),
    (118, 368, 394, 424, 10),
]


def rook(size: int, art: float) -> Image.Image:
    """A cream rook on ink, `art` being how much of the grid the piece fills.

    A maskable icon keeps its artwork inside the safe zone, so it gets a
    smaller piece: the background may bleed, the rook may not.
    """
    image = Image.new("RGB", (size * SUPERSAMPLE, size * SUPERSAMPLE), INK)
    draw = ImageDraw.Draw(image)
    unit = size * SUPERSAMPLE / 512

    def at(x: int, y: int) -> tuple[float, float]:
        return ((x - 256) * art + 256) * unit, ((y - 252) * art + 252) * unit

    draw.polygon([at(x, y) for x, y in CRENEAUX], fill=CREAM)
    draw.polygon([at(x, y) for x, y in CORPS], fill=CREAM)
    for x0, y0, x1, y1, radius in PLATEAUX:
        draw.rounded_rectangle(
            (*at(x0, y0), *at(x1, y1)), radius=radius * art * unit, fill=CREAM
        )

    return image.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    for name, size, art in (
        ("pwa-192.png", 192, 0.9),
        ("pwa-512.png", 512, 0.9),
        ("pwa-maskable-512.png", 512, 0.78),
        ("apple-touch-icon.png", 180, 0.9),
    ):
        rook(size, art).save(PUBLIC / name, optimize=True)
        print(f"wrote public/{name}")


if __name__ == "__main__":
    main()
