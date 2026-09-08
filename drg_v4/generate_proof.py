import json
import math
from pathlib import Path
from dataclasses import dataclass
from typing import List, Optional

from shapely.geometry import box


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "proof_output"
OUT.mkdir(exist_ok=True)


# ==============================================================
# MODELS
# ==============================================================

@dataclass
class Room:
    name: str
    kind: str

    x: float
    y: float
    w: float
    h: float

    door_side: Optional[str] = None
    door_offset: float = 0.5

    windows: Optional[List[str]] = None


@dataclass
class Floor:
    level: int
    name: str
    rooms: List[Room]
    parking: Optional[Room] = None
    balcony: Optional[Room] = None


# ==============================================================
# INPUT
# ==============================================================

with open(
    ROOT / "acceptance_test_30x40_g2.json",
    "r",
    encoding="utf-8"
) as f:
    inp = json.load(f)


PW = float(inp["plotWidthFt"])
PL = float(inp["plotLengthFt"])

SB = inp["setbacks"]

LEFT = float(SB["left"])
RIGHT = float(SB["right"])
FRONT = float(SB["front"])
REAR = float(SB["rear"])

BX = LEFT
BY = FRONT
BW = PW - LEFT - RIGHT
BH = PL - FRONT - REAR

FACING = str(inp["facing"]).upper()
PARKING = inp["parking"]

EXT = float(inp.get("externalWallThicknessInches", 9))
INT = float(inp.get("internalWallThicknessInches", 4.5))


# ==============================================================
# SAFETY / GEOMETRY QA
# ==============================================================

def intersects(a: Room, b: Room) -> bool:

    pa = box(a.x, a.y, a.x + a.w, a.y + a.h)
    pb = box(b.x, b.y, b.x + b.w, b.y + b.h)

    inter = pa.intersection(pb)

    return inter.area > 0.05


def validate_floor(floor: Floor):

    issues = []

    all_rooms = list(floor.rooms)

    if floor.parking:
        all_rooms.append(floor.parking)

    if floor.balcony:
        all_rooms.append(floor.balcony)

    for i in range(len(all_rooms)):

        a = all_rooms[i]

        if (
            a.x < BX - 0.01 or
            a.y < BY - 0.01 or
            a.x + a.w > BX + BW + 0.01 or
            a.y + a.h > BY + BH + 0.01
        ):
            issues.append(
                f"{a.name} outside buildable envelope"
            )

        for j in range(i + 1, len(all_rooms)):

            b = all_rooms[j]

            if intersects(a, b):
                issues.append(
                    f"{a.name} overlaps {b.name}"
                )

    return issues


# ==============================================================
# PARAMETRIC ARCHITECTURAL PLAN
#
# Coordinate system:
# x = west -> east
# y = south/front -> north/rear
#
# SOUTH FACING:
# road/main entrance at y = 0 side
# ==============================================================

def make_ground_floor() -> Floor:

    rooms = []

    # Half parking = one car only, not whole ground floor.
    parking_w = min(9.0, BW * 0.38)
    parking_d = min(16.5, BH * 0.42)

    parking = Room(
        "HALF PARKING",
        "parking",
        BX,
        BY,
        parking_w,
        parking_d,
        windows=[]
    )


    # Stair positioned on front/service side, vertically fixed.
    stair_w = 7.0
    stair_h = 13.0

    stair = Room(
        "STAIR",
        "stair",
        BX + BW - stair_w,
        BY,
        stair_w,
        stair_h,
        door_side="west",
        windows=["south"]
    )

    rooms.append(stair)


    # Main entry between parking and stair.
    entry_x = parking.x + parking.w + 1.0

    foyer_w = max(
        4.5,
        min(
            6.0,
            stair.x - entry_x - 0.5
        )
    )

    foyer = Room(
        "FOYER / ENTRY",
        "foyer",
        entry_x,
        BY,
        foyer_w,
        6.0,
        door_side="south",
        windows=[]
    )

    rooms.append(foyer)


    # Living — front/central.
    living_x = parking.x + parking.w + 1.0
    living_y = BY + 6.0

    living_w = max(
        10.0,
        stair.x - living_x
    )

    living_h = 10.0

    living = Room(
        "LIVING",
        "living",
        living_x,
        living_y,
        living_w,
        living_h,
        door_side="south",
        windows=["east"]
    )

    rooms.append(living)


    # Dining immediately behind living.
    dining = Room(
        "DINING",
        "dining",
        living_x,
        living_y + living_h,
        living_w,
        8.0,
        door_side="south",
        windows=[]
    )

    rooms.append(dining)


    # Kitchen rear-east, connected to dining.
    kitchen_w = 9.0
    kitchen_h = 9.0

    kitchen = Room(
        "KITCHEN",
        "kitchen",
        BX + BW - kitchen_w,
        BY + BH - kitchen_h,
        kitchen_w,
        kitchen_h,
        door_side="south",
        windows=["east", "north"]
    )

    rooms.append(kitchen)


    # Utility directly attached to kitchen.
    utility = Room(
        "UTILITY",
        "utility",
        BX + BW - kitchen_w,
        BY + BH - kitchen_h - 5.0,
        kitchen_w,
        5.0,
        door_side="north",
        windows=["east"]
    )

    rooms.append(utility)


    # Pooja near dining, away from toilet.
    pooja = Room(
        "POOJA",
        "pooja",
        BX + parking_w + 1.0,
        BY + BH - 6.0,
        5.0,
        6.0,
        door_side="south",
        windows=["north"]
    )

    rooms.append(pooja)


    # Common toilet service zone, not opening into kitchen/pooja.
    toilet = Room(
        "COMMON TOILET",
        "toilet",
        BX,
        BY + BH - 7.0,
        4.5,
        7.0,
        door_side="east",
        windows=["west", "north"]
    )

    rooms.append(toilet)


    return Floor(
        level=0,
        name="GROUND FLOOR",
        rooms=rooms,
        parking=parking
    )


def upper_core():

    return Room(
        "STAIR",
        "stair",
        BX + BW - 7.0,
        BY,
        7.0,
        13.0,
        door_side="west",
        windows=["south"]
    )


def make_first_floor() -> Floor:

    rooms = []

    stair = upper_core()
    rooms.append(stair)


    # Master in south-west/private zone.
    master = Room(
        "MASTER BEDROOM",
        "master",
        BX,
        BY,
        11.0,
        12.0,
        door_side="east",
        windows=["south", "west"]
    )

    rooms.append(master)


    master_toilet = Room(
        "ATT. TOILET",
        "toilet",
        BX,
        BY + 12.0,
        4.5,
        7.0,
        door_side="east",
        windows=["west"]
    )

    rooms.append(master_toilet)


    # Bedroom 2 rear-west.
    bed2 = Room(
        "BEDROOM 2",
        "bedroom",
        BX,
        BY + BH - 11.0,
        10.5,
        11.0,
        door_side="east",
        windows=["west", "north"]
    )

    rooms.append(bed2)


    # Bedroom 3 rear-east.
    bed3 = Room(
        "BEDROOM 3",
        "bedroom",
        BX + BW - 11.0,
        BY + BH - 11.0,
        11.0,
        11.0,
        door_side="west",
        windows=["east", "north"]
    )

    rooms.append(bed3)


    # Common toilet between bedrooms.
    common_toilet = Room(
        "COMMON TOILET",
        "toilet",
        BX + BW / 2 - 2.25,
        BY + BH - 7.0,
        4.5,
        7.0,
        door_side="south",
        windows=["north"]
    )

    rooms.append(common_toilet)


    # Family lounge connects stair to bedrooms.
    lounge = Room(
        "FAMILY LOUNGE",
        "family",
        BX + 11.0,
        BY + 7.0,
        max(
            10.0,
            BW - 18.0
        ),
        12.0,
        door_side="south",
        windows=["east"]
    )

    rooms.append(lounge)


    balcony = Room(
        "BALCONY",
        "balcony",
        BX + BW - 8.0,
        BY + 13.0,
        8.0,
        5.0,
        door_side="west",
        windows=[]
    )


    return Floor(
        level=1,
        name="FIRST FLOOR",
        rooms=rooms,
        balcony=balcony
    )


def make_second_floor() -> Floor:

    rooms = []

    stair = upper_core()
    rooms.append(stair)


    multipurpose = Room(
        "MULTIPURPOSE / FAMILY",
        "family",
        BX,
        BY,
        min(14.0, BW - 8.0),
        12.0,
        door_side="east",
        windows=["south", "west"]
    )

    rooms.append(multipurpose)


    study = Room(
        "STUDY / HOME OFFICE",
        "study",
        BX,
        BY + 12.0,
        10.0,
        9.0,
        door_side="east",
        windows=["west"]
    )

    rooms.append(study)


    toilet = Room(
        "TOILET",
        "toilet",
        BX + BW - 4.5,
        BY + 13.0,
        4.5,
        7.0,
        door_side="west",
        windows=["east"]
    )

    rooms.append(toilet)


    # Remaining open terrace deliberately left unbuilt.
    terrace = Room(
        "OPEN TERRACE",
        "terrace",
        BX,
        BY + 22.0,
        BW,
        max(
            6.0,
            BH - 22.0
        ),
        windows=[]
    )

    rooms.append(terrace)


    return Floor(
        level=2,
        name="SECOND FLOOR",
        rooms=rooms
    )


floors = [
    make_ground_floor(),
    make_first_floor(),
    make_second_floor()
]


# ==============================================================
# SVG RENDERER
# ==============================================================

CW = 920
CH = 1100

M_LEFT = 120
M_TOP = 120

SCALE = min(
    20.0,
    (CW - 240) / PW,
    (CH - 300) / PL
)


def X(v):
    return M_LEFT + v * SCALE


def Y(v):
    # South/front at bottom
    return M_TOP + (PL - v) * SCALE


def svg_rect(r: Room, fill="white", dash=None):

    x = X(r.x)
    y = Y(r.y + r.h)

    w = r.w * SCALE
    h = r.h * SCALE

    dash_attr = (
        f' stroke-dasharray="{dash}"'
        if dash else ""
    )

    return f'''
<rect
 x="{x:.1f}"
 y="{y:.1f}"
 width="{w:.1f}"
 height="{h:.1f}"
 fill="{fill}"
 stroke="#172554"
 stroke-width="2.3"
 {dash_attr}
/>
'''


def room_label(r: Room):

    x = X(r.x + r.w / 2)
    y = Y(r.y + r.h / 2)

    return f'''
<text
 x="{x:.1f}"
 y="{y - 7:.1f}"
 text-anchor="middle"
 font-family="Arial"
 font-size="11"
 font-weight="700"
 fill="#0f172a"
>
 {r.name}
</text>

<text
 x="{x:.1f}"
 y="{y + 8:.1f}"
 text-anchor="middle"
 font-family="Arial"
 font-size="9"
 font-weight="700"
 fill="#1d4ed8"
>
 {r.w:.1f}' × {r.h:.1f}'
</text>
'''


def door_svg(r: Room):

    if not r.door_side:
        return ""

    d = min(
        3.5,
        max(
            2.5,
            min(r.w, r.h) * 0.28
        )
    )

    if r.door_side == "south":

        x = r.x + r.w * r.door_offset

        x1 = X(x)
        y1 = Y(r.y)

        return f'''
<line x1="{x1:.1f}" y1="{y1:.1f}"
      x2="{X(x + d):.1f}" y2="{y1:.1f}"
      stroke="white" stroke-width="5"/>

<path d="M {x1:.1f} {y1:.1f}
         A {d*SCALE:.1f} {d*SCALE:.1f}
         0 0 1
         {X(x+d):.1f} {Y(r.y+d):.1f}"
      fill="none"
      stroke="#92400e"
      stroke-width="1"/>
'''

    if r.door_side == "north":

        x = r.x + r.w * r.door_offset

        y1 = Y(r.y + r.h)

        return f'''
<line x1="{X(x):.1f}" y1="{y1:.1f}"
      x2="{X(x+d):.1f}" y2="{y1:.1f}"
      stroke="white" stroke-width="5"/>

<path d="M {X(x):.1f} {y1:.1f}
         A {d*SCALE:.1f} {d*SCALE:.1f}
         0 0 0
         {X(x+d):.1f} {Y(r.y+r.h-d):.1f}"
      fill="none"
      stroke="#92400e"
      stroke-width="1"/>
'''

    if r.door_side == "east":

        y = r.y + r.h * r.door_offset

        x1 = X(r.x + r.w)

        return f'''
<line x1="{x1:.1f}" y1="{Y(y):.1f}"
      x2="{x1:.1f}" y2="{Y(y+d):.1f}"
      stroke="white" stroke-width="5"/>

<path d="M {x1:.1f} {Y(y):.1f}
         A {d*SCALE:.1f} {d*SCALE:.1f}
         0 0 1
         {X(r.x+r.w-d):.1f} {Y(y+d):.1f}"
      fill="none"
      stroke="#92400e"
      stroke-width="1"/>
'''

    if r.door_side == "west":

        y = r.y + r.h * r.door_offset

        x1 = X(r.x)

        return f'''
<line x1="{x1:.1f}" y1="{Y(y):.1f}"
      x2="{x1:.1f}" y2="{Y(y+d):.1f}"
      stroke="white" stroke-width="5"/>

<path d="M {x1:.1f} {Y(y):.1f}
         A {d*SCALE:.1f} {d*SCALE:.1f}
         0 0 0
         {X(r.x+d):.1f} {Y(y+d):.1f}"
      fill="none"
      stroke="#92400e"
      stroke-width="1"/>
'''

    return ""


def window_svg(r: Room):

    result = []

    for side in (r.windows or []):

        if side in ("south", "north"):

            ww = min(5.0, r.w * 0.45)
            sx = r.x + (r.w - ww) / 2

            yy = (
                r.y
                if side == "south"
                else r.y + r.h
            )

            result.append(
f'''
<line x1="{X(sx):.1f}" y1="{Y(yy):.1f}"
      x2="{X(sx+ww):.1f}" y2="{Y(yy):.1f}"
      stroke="white" stroke-width="5"/>

<line x1="{X(sx):.1f}" y1="{Y(yy):.1f}"
      x2="{X(sx+ww):.1f}" y2="{Y(yy):.1f}"
      stroke="#0284c7" stroke-width="1.5"/>
'''
            )

        else:

            wh = min(5.0, r.h * 0.45)
            sy = r.y + (r.h - wh) / 2

            xx = (
                r.x
                if side == "west"
                else r.x + r.w
            )

            result.append(
f'''
<line x1="{X(xx):.1f}" y1="{Y(sy):.1f}"
      x2="{X(xx):.1f}" y2="{Y(sy+wh):.1f}"
      stroke="white" stroke-width="5"/>

<line x1="{X(xx):.1f}" y1="{Y(sy):.1f}"
      x2="{X(xx):.1f}" y2="{Y(sy+wh):.1f}"
      stroke="#0284c7" stroke-width="1.5"/>
'''
            )

    return "".join(result)


def stair_symbol(r: Room):

    if r.kind != "stair":
        return ""

    count = 10
    step = r.h / count

    lines = []

    for i in range(count + 1):

        yy = r.y + i * step

        lines.append(
f'''
<line
 x1="{X(r.x):.1f}"
 y1="{Y(yy):.1f}"
 x2="{X(r.x+r.w):.1f}"
 y2="{Y(yy):.1f}"
 stroke="#64748b"
 stroke-width="0.8"
/>
'''
        )

    cx = X(r.x + r.w / 2)

    return (
        "".join(lines) +
f'''
<line
 x1="{cx:.1f}"
 y1="{Y(r.y+1):.1f}"
 x2="{cx:.1f}"
 y2="{Y(r.y+r.h-1):.1f}"
 stroke="#2563eb"
 stroke-width="1.5"
/>

<text
 x="{cx+8:.1f}"
 y="{Y(r.y+r.h/2):.1f}"
 font-family="Arial"
 font-size="9"
 font-weight="700"
 fill="#2563eb"
>
 UP
</text>
'''
    )


def render_floor(floor: Floor):

    issues = validate_floor(floor)

    room_items = []

    if floor.parking:

        room_items.append(
            svg_rect(
                floor.parking,
                "#f8fafc",
                "5 3"
            )
        )

        room_items.append(
            room_label(
                floor.parking
            )
        )


    if floor.balcony:

        room_items.append(
            svg_rect(
                floor.balcony,
                "#f0fdfa"
            )
        )

        room_items.append(
            room_label(
                floor.balcony
            )
        )


    for r in floor.rooms:

        fill = "#ffffff"

        if r.kind == "toilet":
            fill = "#f8fafc"

        elif r.kind == "stair":
            fill = "#f1f5f9"

        elif r.kind == "terrace":
            fill = "#fafafa"

        room_items.append(
            svg_rect(
                r,
                fill
            )
        )

        room_items.append(
            room_label(r)
        )

        room_items.append(
            door_svg(r)
        )

        room_items.append(
            window_svg(r)
        )

        room_items.append(
            stair_symbol(r)
        )


    front_y = Y(0)

    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 {CW} {CH}"
     width="{CW}"
     height="{CH}">

<rect width="100%" height="100%" fill="#fff"/>

<text
 x="{CW/2}"
 y="34"
 text-anchor="middle"
 font-family="Arial"
 font-size="20"
 font-weight="900"
 fill="#0f172a"
>
 BUILDMITRA PROFESSIONAL DRG V4
</text>

<text
 x="{CW/2}"
 y="58"
 text-anchor="middle"
 font-family="Arial"
 font-size="14"
 font-weight="800"
 fill="#0f766e"
>
 {floor.name} — {PW:.0f}' × {PL:.0f}' — {FACING} FACING
</text>


<!-- Plot boundary -->
<rect
 x="{X(0):.1f}"
 y="{Y(PL):.1f}"
 width="{PW*SCALE:.1f}"
 height="{PL*SCALE:.1f}"
 fill="none"
 stroke="#111827"
 stroke-width="2"
/>


<!-- Buildable envelope -->
<rect
 x="{X(BX):.1f}"
 y="{Y(BY+BH):.1f}"
 width="{BW*SCALE:.1f}"
 height="{BH*SCALE:.1f}"
 fill="none"
 stroke="#ef4444"
 stroke-width="1.2"
 stroke-dasharray="6 4"
/>


<!-- Dimensions -->
<line
 x1="{X(0):.1f}"
 y1="82"
 x2="{X(PW):.1f}"
 y2="82"
 stroke="#dc2626"
 stroke-width="1"
/>

<text
 x="{X(PW/2):.1f}"
 y="76"
 text-anchor="middle"
 font-family="Arial"
 font-size="11"
 font-weight="700"
 fill="#dc2626"
>
 {PW:.0f}'-0"
</text>


<line
 x1="72"
 y1="{Y(0):.1f}"
 x2="72"
 y2="{Y(PL):.1f}"
 stroke="#dc2626"
 stroke-width="1"
/>

<text
 x="56"
 y="{(Y(0)+Y(PL))/2:.1f}"
 text-anchor="middle"
 font-family="Arial"
 font-size="11"
 font-weight="700"
 fill="#dc2626"
 transform="rotate(-90 56 {(Y(0)+Y(PL))/2:.1f})"
>
 {PL:.0f}'-0"
</text>


<!-- South road -->
<rect
 x="{X(0):.1f}"
 y="{front_y+8:.1f}"
 width="{PW*SCALE:.1f}"
 height="35"
 fill="#e2e8f0"
 stroke="#64748b"
 stroke-width="1"
/>

<text
 x="{X(PW/2):.1f}"
 y="{front_y+30:.1f}"
 text-anchor="middle"
 font-family="Arial"
 font-size="10"
 font-weight="800"
 fill="#334155"
>
 ROAD — SOUTH FACING
</text>


{''.join(room_items)}


<!-- Main entry arrow -->
<path
 d="M {X(PW*0.60):.1f} {front_y+40:.1f}
    L {X(PW*0.60):.1f} {front_y-12:.1f}"
 stroke="#0f766e"
 stroke-width="2"
 marker-end="url(#arrow)"
/>


<defs>
 <marker
   id="arrow"
   markerWidth="8"
   markerHeight="8"
   refX="4"
   refY="4"
   orient="auto">
   <path
     d="M0,0 L8,4 L0,8 Z"
     fill="#0f766e"/>
 </marker>
</defs>


<text
 x="{X(PW*0.60):.1f}"
 y="{front_y+58:.1f}"
 text-anchor="middle"
 font-family="Arial"
 font-size="10"
 font-weight="800"
 fill="#0f766e"
>
 MAIN ENTRY
</text>


<!-- Notes -->
<rect
 x="105"
 y="{CH-155}"
 width="{CW-210}"
 height="110"
 fill="#f8fafc"
 stroke="#cbd5e1"
/>

<text
 x="125"
 y="{CH-130}"
 font-family="Arial"
 font-size="11"
 font-weight="800"
 fill="#0f172a">
 DESIGN DATA
</text>

<text
 x="125"
 y="{CH-110}"
 font-family="Arial"
 font-size="9"
 fill="#334155">
 Plot: {PW:.0f}' × {PL:.0f}' | Facing: {FACING} | Parking: {PARKING}
</text>

<text
 x="125"
 y="{CH-92}"
 font-family="Arial"
 font-size="9"
 fill="#334155">
 External wall: {EXT:g}" | Internal wall: {INT:g}" | Storeys: {inp["floors"]}
</text>

<text
 x="125"
 y="{CH-74}"
 font-family="Arial"
 font-size="9"
 fill="{'#166534' if not issues else '#b91c1c'}">
 QA: {'PASS' if not issues else 'REVIEW — ' + '; '.join(issues[:3])}
</text>

</svg>
'''

    path = OUT / f"floor_{floor.level}_{floor.name.lower().replace(' ','_')}.svg"

    path.write_text(
        svg,
        encoding="utf-8"
    )

    return path, issues


# ==============================================================
# GENERATE
# ==============================================================

outputs = []
all_issues = []

for floor in floors:

    path, issues = render_floor(floor)

    outputs.append(path)

    all_issues.extend(
        [
            f"{floor.name}: {x}"
            for x in issues
        ]
    )


html_cards = []

for floor, path in zip(floors, outputs):

    html_cards.append(
f'''
<section class="card">
 <h2>{floor.name}</h2>
 <object
   data="{path.name}"
   type="image/svg+xml">
 </object>
</section>
'''
    )


html = f'''<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>BuildMitra DRG V4 Proof</title>

<style>
body {{
 font-family: Arial, sans-serif;
 margin: 0;
 background: #f1f5f9;
 color: #0f172a;
}}

header {{
 background: white;
 padding: 18px;
 text-align: center;
 border-bottom: 1px solid #cbd5e1;
}}

.grid {{
 display: grid;
 grid-template-columns:
   repeat(auto-fit,minmax(600px,1fr));
 gap: 16px;
 padding: 16px;
}}

.card {{
 background: white;
 border-radius: 12px;
 padding: 12px;
 box-shadow: 0 4px 18px rgba(0,0,0,.08);
}}

object {{
 display: block;
 width: 100%;
 min-height: 850px;
 border: 1px solid #e2e8f0;
}}

.pass {{
 color: #166534;
 font-weight: 800;
}}

.fail {{
 color: #b91c1c;
 font-weight: 800;
}}
</style>
</head>

<body>

<header>
<h1>BuildMitra DRG V4 — Standalone Acceptance Proof</h1>

<p>
30×40 • South Facing • G+2 • Half Parking
</p>

<p class="{'pass' if not all_issues else 'fail'}">
Geometry QA:
{'PASS' if not all_issues else 'REVIEW'}
</p>

</header>

<div class="grid">
{''.join(html_cards)}
</div>

</body>
</html>
'''

html_path = OUT / "BuildMitra-DRG-V4-Proof.html"

html_path.write_text(
    html,
    encoding="utf-8"
)


print("")
print("==============================================")
print("BUILDMITRA DRG V4 PROOF GENERATED")
print("==============================================")

for p in outputs:
    print(p)

print(html_path)

print("")
print("GEOMETRY QA:", "PASS" if not all_issues else "REVIEW")

for issue in all_issues:
    print(" -", issue)
