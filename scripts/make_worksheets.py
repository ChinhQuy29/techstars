"""Generate sample worksheet photos + JSON sidecars (the 'expected extraction') in test-worksheets/.

The sidecars are used by MOCK mode (no Gemini key) and as fixtures for API testing (Bruno).
Run: python scripts/make_worksheets.py
"""
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parents[1] / "test-worksheets"
W, H = 1000, 1300
FONTS = Path("C:/Windows/Fonts")


def font(name: str, size: int, fallback: str = "DejaVuSans.ttf"):
    for candidate in (FONTS / name, Path(name), Path(fallback)):
        try:
            return ImageFont.truetype(str(candidate), size)
        except OSError:
            continue
    return ImageFont.load_default()


PRINTED = font("arial.ttf", 58)
TITLE = font("arialbd.ttf", 44)
SMALL = font("arial.ttf", 30)
HAND = font("segoepr.ttf", 62)
HAND_SMALL = font("segoepr.ttf", 34)

# (id, printed problem, normalized expression)
PROBLEMS = [
    (1, "23 + 14 =", "23 + 14"),
    (2, "47 + 38 =", "47 + 38"),
    (3, "9 × 6 =", "9 * 6"),
    (4, "52 − 17 =", "52 - 17"),
    (5, "36 ÷ 4 =", "36 / 4"),
    (6, "8 + 7 =", "8 + 7"),
]

SHEETS = {
    "worksheet-1": {1: "37", 2: "75", 3: "54", 4: "45", 5: "9", 6: "15"},  # two mistakes
    "worksheet-2": {1: "37", 2: "85", 3: "54", 4: "35", 5: "9", 6: "15"},  # mistakes fixed
}


def norm(box):
    x0, y0, x1, y1 = box
    return [round(y0 * 1000 / H), round(x0 * 1000 / W), round(y1 * 1000 / H), round(x1 * 1000 / W)]


def make(name: str, answers: dict[int, str]) -> None:
    rng = random.Random(name)
    img = Image.new("RGB", (W, H), (250, 247, 238))
    d = ImageDraw.Draw(img)
    for y in range(260, H, 60):  # faint ruled lines
        d.line([(40, y), (W - 40, y)], fill=(222, 228, 240), width=2)
    d.text((60, 60), "Math Practice", font=TITLE, fill=(30, 30, 30))
    d.text((60, 130), "Name: ________   Solve each problem.", font=SMALL, fill=(60, 60, 60))
    d.text((210, 118), "Sam", font=HAND_SMALL, fill=(70, 70, 110))

    problems = []
    for i, (pid, printed, expr) in enumerate(PROBLEMS):
        col, row = i % 2, i // 2
        x, y = 70 + col * 470, 260 + row * 330
        d.text((x, y), f"{pid}.", font=SMALL, fill=(90, 90, 90))
        px = x + 50
        d.text((px, y + 40), printed, font=PRINTED, fill=(20, 20, 20))
        pw = d.textlength(printed, font=PRINTED)
        ans = answers[pid]
        ax = px + pw + 22 + rng.randint(-4, 4)
        ay = y + 24 + rng.randint(-6, 6)
        d.text((ax, ay), ans, font=HAND, fill=(55, 60, 95))
        aw = d.textlength(ans, font=HAND)
        has_work = False
        if pid == 2 and ans == "85":  # visible carried 1 on the fixed sheet
            d.text((px + 4, y - 18), "1", font=HAND_SMALL, fill=(55, 60, 95))
            has_work = True
        answer_box = (ax - 8, ay + 8, ax + aw + 8, ay + 100)
        problem_box = (x - 10, y - 20, ax + aw + 20, y + 130)
        problems.append({
            "id": pid,
            "problem": expr,
            "child_answer": ans,
            "bbox": norm(problem_box),
            "answer_bbox": norm(answer_box),
            "confidence": 0.95,
            "has_work": has_work,
        })

    img = img.rotate(rng.uniform(-1.2, 1.2), resample=Image.BICUBIC, fillcolor=(235, 232, 222))
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    OUT.mkdir(exist_ok=True)
    img.save(OUT / f"{name}.png", optimize=True)
    sidecar = {
        "description": f"Sample {name}: expected extraction (what the vision LLM should return).",
        "extraction": {"hand_blocking": False, "unreadable": False, "problems": problems},
    }
    (OUT / f"{name}.json").write_text(json.dumps(sidecar, indent=2, ensure_ascii=False), encoding="utf-8")
    print("wrote", name)


if __name__ == "__main__":
    for name, answers in SHEETS.items():
        make(name, answers)
