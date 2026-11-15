"""Dress Lumi's mood poses in each dream's outfit (docs/12-dreams.md).

Inputs (all exported from the Figma file "Lumi", page "new", backgrounds removed):
  frontend/public/assets/mascot/lumi-<pose>.svg   the mood poses (waving, excited, thinking, confused, sleeping)
  frontend/public/assets/dreams/<dream>.svg       one drawing per dream (astronaut, baker, doctor)
Output:
  frontend/public/assets/mascot/<dream>/lumi-<pose>.svg

How each outfit piece is placed:
  head  (helmet, chef's hat)  pinned to Lumi's two ear bolts, so it follows the head's position, size and tilt
  body  (apron, coat)         fitted to the body, then trimmed to that pose's body outline (no floating sleeves)
  chest (stethoscope)         fitted to the body, not trimmed
  hand  (baguette)            moved to Lumi's left hand

The anchor numbers below were measured in a browser with getBBox() (ear bolt centres, body and hand boxes). If a
pose or a dream drawing changes in Figma, measure again (docs/12-dreams.md has the snippet) and rerun:
    python scripts/dream_outfits.py
"""
from __future__ import annotations

import copy
import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path

SVG = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG)
Q = lambda tag: f"{{{SVG}}}{tag}"  # noqa: E731

ROOT = Path(__file__).resolve().parents[1] / "frontend" / "public" / "assets"
POSES = ["waving", "excited", "thinking", "confused", "sleeping"]

# Ear bolt centres (left = "Union_2", right = "Union"), body box ("Vector 2"), left-hand centre ("Vector 7").
ANCHORS = {
    "waving":    {"ears": ((55.33, 58.5), (256.42, 110.44)), "body": (50.8, 160.68, 134.33, 129.46), "hand": (27.05, 111.1)},
    "excited":   {"ears": ((56.13, 58.66), (257.08, 111.26)), "body": (51.07, 160.93, 134.39, 129.62), "hand": (27.7, 111.21)},
    "thinking":  {"ears": ((68.65, 105.5), (279.53, 112.67)), "body": (98.46, 198.33, 136.34, 124.11), "hand": (60.64, 254.46)},
    "confused":  {"ears": ((66.83, 119.65), (276.9, 98.77)), "body": (98.46, 196.28, 136.11, 126.15), "hand": (60.64, 254.46)},
    "sleeping":  {"ears": ((68.65, 105.5), (279.53, 112.67)), "body": (98.46, 198.33, 136.34, 124.11), "hand": (60.64, 254.46)},
    "astronaut": {"ears": ((58.36, 129.62), (270.46, 184.4)), "body": (53.58, 237.39, 141.68, 136.55), "hand": (0, 0)},
    "baker":     {"ears": ((69.83, 182.24), (311.26, 244.6)), "body": (64.39, 304.92, 161.28, 155.44), "hand": (35.87, 245.4)},
    "doctor":    {"ears": ((66.43, 70.24), (307.87, 132.6)), "body": (60.99, 192.92, 161.28, 155.44), "hand": (0, 0)},
}

# The outfit pieces in each dream drawing, by Figma layer name.
OUTFITS = {
    "astronaut": [("head", ["Group 12", "Vector 72"])],
    "baker": [("body", ["Group 25"]), ("hand", ["Rectangle 28", "Vector 97", "Vector 98", "Vector 99"]), ("head", ["Group 21"])],
    "doctor": [("body", ["Vector 104", "Vector 105", "Vector 106", "Vector 107"]), ("chest", ["Group 28"])],
}

# The outfit canvas: taller than the plain poses so hats and helmets fit; the foot shadow sits at the same spot
# (ANCHOR) in every pose, as in the plain poses (lumiAssets.ts ARTWORK_SIZE / OUTFIT_SIZE).
OUT_W, OUT_H = 372, 470
ANCHOR = (186, 449)
SHADOW = {"waving": (109.5, 320.5), "excited": (109.496, 320.841), "thinking": (176.539, 349.702),
          "confused": (171.539, 349.702), "sleeping": (174.5, 349.5)}


def similarity(src: tuple, dst: tuple) -> tuple[float, float, float, float, float, float]:
    """The scale + rotation + move that takes the two src points onto the two dst points (SVG matrix a..f)."""
    (sx1, sy1), (sx2, sy2) = src
    (dx1, dy1), (dx2, dy2) = dst
    s = math.dist(dst[0], dst[1]) / math.dist(src[0], src[1])
    t = math.atan2(dy2 - dy1, dx2 - dx1) - math.atan2(sy2 - sy1, sx2 - sx1)
    a, b = s * math.cos(t), s * math.sin(t)
    return a, b, -b, a, dx1 - (a * sx1 - b * sy1), dy1 - (b * sx1 + a * sy1)


def head_tilt(name: str) -> float:
    (x1, y1), (x2, y2) = ANCHORS[name]["ears"]
    return math.atan2(y2 - y1, x2 - x1)


def body_matrix(dream: str, pose: str):
    """Body box onto body box (centre to centre, scaled by width), turned by the change in head tilt."""
    dx, dy, dw, dh = ANCHORS[dream]["body"]
    px, py, pw, ph = ANCHORS[pose]["body"]
    s = pw / dw
    t = head_tilt(pose) - head_tilt(dream)
    a, b = s * math.cos(t), s * math.sin(t)
    cx, cy, qx, qy = dx + dw / 2, dy + dh / 2, px + pw / 2, py + ph / 2
    return a, b, -b, a, qx - (a * cx - b * cy), qy - (b * cx + a * cy)


def hand_matrix(dream: str, pose: str):
    """Same size as the head pieces, upright, moved from the dream's hand to the pose's hand."""
    s = math.dist(*ANCHORS[pose]["ears"]) / math.dist(*ANCHORS[dream]["ears"])
    (hx, hy), (px, py) = ANCHORS[dream]["hand"], ANCHORS[pose]["hand"]
    return s, 0, 0, s, px - s * hx, py - s * hy


def find(tree: ET.Element, layer: str) -> ET.Element:
    for el in tree.iter():
        if el.get("id") == layer:
            return el
    raise KeyError(layer)


def parent_of(tree: ET.Element, child: ET.Element) -> ET.Element:
    for el in tree.iter():
        if child in list(el):
            return el
    raise KeyError(child.get("id"))


def referenced_defs(pieces: list[ET.Element], defs: ET.Element) -> list[ET.Element]:
    text = "".join(ET.tostring(p, encoding="unicode") for p in pieces)
    ids = set(re.findall(r"url\(#([^)]+)\)", text))
    return [d for d in defs if d.get("id") in ids]


def matrix(m) -> str:
    return "matrix(" + " ".join(f"{v:.5f}" for v in m) + ")"


def dress(dream: str, pose: str) -> str:
    pose_tree = ET.parse(ROOT / "mascot" / f"lumi-{pose}.svg").getroot()
    dream_tree = ET.parse(ROOT / "dreams" / f"{dream}.svg").getroot()
    pose_defs = pose_tree.find(Q("defs"))
    dream_defs = dream_tree.find(Q("defs"))
    body_el = find(pose_tree, "Vector 2")
    chest_el = find(pose_tree, "Vector 17")  # the chest screen: body pieces go just above it, under the head
    figure = parent_of(pose_tree, body_el)
    under_head = list(figure).index(chest_el) + 1

    clip = ET.SubElement(pose_defs, Q("clipPath"), id=f"outfit_body_{dream}_{pose}")
    ET.SubElement(clip, Q("path"), d=body_el.get("d"))

    on_top: list[ET.Element] = []
    for kind, layers in OUTFITS[dream]:
        pieces = [copy.deepcopy(find(dream_tree, layer)) for layer in layers]
        for d in referenced_defs(pieces, dream_defs):
            if pose_defs.find(f"*[@id='{d.get('id')}']") is None:
                pose_defs.append(copy.deepcopy(d))
        m = {"head": lambda: similarity(ANCHORS[dream]["ears"], ANCHORS[pose]["ears"]),
             "body": lambda: body_matrix(dream, pose), "chest": lambda: body_matrix(dream, pose),
             "hand": lambda: hand_matrix(dream, pose)}[kind]()
        g = ET.Element(Q("g"), id=f"outfit {kind}", transform=matrix(m))
        g.extend(pieces)
        if kind == "body":
            wrap = ET.Element(Q("g"), {"clip-path": f"url(#outfit_body_{dream}_{pose})"})
            wrap.append(g)
            figure.insert(under_head, wrap)
            under_head += 1
        elif kind == "chest":
            figure.insert(under_head, g)
            under_head += 1
        else:
            on_top.append(g)
    figure.extend(on_top)

    ax, ay = SHADOW[pose]
    pose_tree.set("width", str(OUT_W))
    pose_tree.set("height", str(OUT_H))
    pose_tree.set("viewBox", f"{ax - ANCHOR[0]:.3f} {ay - ANCHOR[1]:.3f} {OUT_W} {OUT_H}")
    return ET.tostring(pose_tree, encoding="unicode")


def main() -> None:
    for dream in OUTFITS:
        out = ROOT / "mascot" / dream
        out.mkdir(exist_ok=True)
        for pose in POSES:
            (out / f"lumi-{pose}.svg").write_text(dress(dream, pose), encoding="utf-8")
            print(f"{dream}/lumi-{pose}.svg")


if __name__ == "__main__":
    main()
