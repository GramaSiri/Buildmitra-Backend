from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
import fitz
import hashlib
import json

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "source"
PREVIEW = ROOT / "preview"

PREVIEW.mkdir(exist_ok=True)

records = []


def safe_name(path):
    return "".join(
        c if c.isalnum() or c in "-_" else "_"
        for c in path.stem
    )


def render_pdf(path):

    doc = fitz.open(path)

    pages = []

    max_pages = min(3, len(doc))

    for i in range(max_pages):

        page = doc[i]

        matrix = fitz.Matrix(1.6, 1.6)

        pix = page.get_pixmap(
            matrix=matrix,
            alpha=False
        )

        out = PREVIEW / f"{safe_name(path)}_page_{i+1}.png"

        pix.save(out)

        pages.append(out)

    return pages


def copy_image(path):

    img = Image.open(path).convert("RGB")

    out = PREVIEW / f"{safe_name(path)}.jpg"

    # Preserve enough detail while keeping review manageable.
    img.thumbnail((1800, 1800))

    img.save(
        out,
        quality=92
    )

    return [out]


for path in sorted(SRC.iterdir()):

    if not path.is_file():
        continue

    try:

        if path.suffix.lower() == ".pdf":
            previews = render_pdf(path)

        elif path.suffix.lower() in (
            ".png",
            ".jpg",
            ".jpeg",
            ".webp"
        ):
            previews = copy_image(path)

        else:
            continue


        records.append({
            "source": path.name,
            "size_bytes": path.stat().st_size,
            "preview_files": [
                p.name for p in previews
            ]
        })

    except Exception as exc:

        records.append({
            "source": path.name,
            "size_bytes": path.stat().st_size,
            "error": str(exc),
            "preview_files": []
        })


(ROOT / "manifest.json").write_text(
    json.dumps(records, indent=2),
    encoding="utf-8"
)


# ==============================================================
# CONTACT SHEET
# ==============================================================

cards = []

for record in records:

    for preview_name in record.get(
        "preview_files",
        []
    ):

        path = PREVIEW / preview_name

        try:
            img = Image.open(path).convert("RGB")
        except Exception:
            continue

        img.thumbnail((480, 600))

        card = Image.new(
            "RGB",
            (520, 680),
            "white"
        )

        x = (520 - img.width) // 2

        card.paste(
            img,
            (x, 45)
        )

        draw = ImageDraw.Draw(card)

        title = record["source"]

        if len(title) > 55:
            title = title[:52] + "..."

        draw.text(
            (15, 12),
            title,
            fill="black"
        )

        draw.text(
            (15, 650),
            preview_name,
            fill="black"
        )

        card = ImageOps.expand(
            card,
            border=2,
            fill="black"
        )

        cards.append(card)


if not cards:
    raise RuntimeError(
        "No preview cards could be created."
    )


cols = 2
rows = (len(cards) + cols - 1) // cols

sheet = Image.new(
    "RGB",
    (
        cols * 524,
        rows * 684
    ),
    "#dddddd"
)


for idx, card in enumerate(cards):

    x = (idx % cols) * 524
    y = (idx // cols) * 684

    sheet.paste(
        card,
        (x, y)
    )


sheet_path = ROOT / "BuildMitra-Reference-Plan-Contact-Sheet.jpg"

sheet.save(
    sheet_path,
    quality=90
)


print("")
print("==============================================")
print("REFERENCE PLAN REVIEW CREATED")
print("==============================================")
print("Files :", len(records))
print("Cards :", len(cards))
print("")
print(sheet_path)

for r in records:

    if r.get("error"):
        print(
            "ERROR:",
            r["source"],
            "->",
            r["error"]
        )
