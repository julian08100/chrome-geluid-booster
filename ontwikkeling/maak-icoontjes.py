"""Genereert de icoontjes van de extensie (alleen nodig bij een nieuw ontwerp)."""
from pathlib import Path
from PIL import Image, ImageDraw
OUT = Path(__file__).resolve().parent.parent / "extensie" / "icons"
S = 512
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([16, 16, S - 16, S - 16], radius=110, fill=(232, 84, 47, 255))
w = (255, 255, 255, 255)
# luidspreker
d.rectangle([96, 200, 170, 312], fill=w)
d.polygon([(170, 200), (270, 120), (270, 392), (170, 312)], fill=w)
# geluidsgolven
for r, wd in ((70, 30), (130, 30)):
    d.arc([270 - r, 256 - r, 270 + r, 256 + r], start=-50, end=50, fill=w, width=wd)
for size in (16, 32, 48, 128):
    img.resize((size, size), Image.LANCZOS).save(OUT / f"icon{size}.png")
