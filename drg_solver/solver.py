import json
import sys
import time
from ortools.sat.python import cp_model

SCALE = 12


def ft(v):
    return int(round(float(v) * SCALE))


def back(v):
    return round(float(v) / SCALE, 2)


def solve_floor(floor_data, envelope, fixed_core=None, max_seconds=8):
    fixed_core = fixed_core or {}

    rooms = floor_data.get("rooms", [])
    floor_no = int(floor_data.get("floor", 0))

    model = cp_model.CpModel()

    ex = ft(envelope["x"])
    ey = ft(envelope["y"])
    ew = ft(envelope["w"])
    eh = ft(envelope["h"])

    max_x = ex + ew
    max_y = ey + eh

    vars_by_id = {}

    for room in rooms:
        rid = str(room["id"])

        min_w = max(1, ft(room.get("minWidthFt", 4)))
        max_w = max(min_w, min(ft(room.get("maxWidthFt", 20)), ew))

        min_h = max(1, ft(room.get("minDepthFt", 4)))
        max_h = max(min_h, min(ft(room.get("maxDepthFt", 20)), eh))

        x = model.NewIntVar(ex, max_x - min_w, f"{rid}_x")
        y = model.NewIntVar(ey, max_y - min_h, f"{rid}_y")

        w = model.NewIntVar(min_w, max_w, f"{rid}_w")
        h = model.NewIntVar(min_h, max_h, f"{rid}_h")

        x2 = model.NewIntVar(ex + min_w, max_x, f"{rid}_x2")
        y2 = model.NewIntVar(ey + min_h, max_y, f"{rid}_y2")

        model.Add(x2 == x + w)
        model.Add(y2 == y + h)

        vars_by_id[rid] = {
            "room": room,
            "x": x,
            "y": y,
            "w": w,
            "h": h,
            "x2": x2,
            "y2": y2,
        }


    # ------------------------------------------------------------
    # NO OVERLAP
    # ------------------------------------------------------------

    values = list(vars_by_id.values())

    for i in range(len(values)):
        for j in range(i + 1, len(values)):

            a = values[i]
            b = values[j]

            left = model.NewBoolVar(f"sep_{i}_{j}_left")
            right = model.NewBoolVar(f"sep_{i}_{j}_right")
            above = model.NewBoolVar(f"sep_{i}_{j}_above")
            below = model.NewBoolVar(f"sep_{i}_{j}_below")

            model.Add(a["x2"] <= b["x"]).OnlyEnforceIf(left)
            model.Add(b["x2"] <= a["x"]).OnlyEnforceIf(right)
            model.Add(a["y2"] <= b["y"]).OnlyEnforceIf(above)
            model.Add(b["y2"] <= a["y"]).OnlyEnforceIf(below)

            model.AddBoolOr([left, right, above, below])


    # ------------------------------------------------------------
    # EXTERIOR ACCESS
    # ------------------------------------------------------------

    for data in values:

        room = data["room"]

        if not room.get("exteriorAccessRequired", False):
            continue

        l = model.NewBoolVar(f"{room['id']}_ext_l")
        r = model.NewBoolVar(f"{room['id']}_ext_r")
        t = model.NewBoolVar(f"{room['id']}_ext_t")
        b = model.NewBoolVar(f"{room['id']}_ext_b")

        model.Add(data["x"] == ex).OnlyEnforceIf(l)
        model.Add(data["x2"] == max_x).OnlyEnforceIf(r)
        model.Add(data["y"] == ey).OnlyEnforceIf(t)
        model.Add(data["y2"] == max_y).OnlyEnforceIf(b)

        model.AddBoolOr([l, r, t, b])


    # ------------------------------------------------------------
    # REQUIRED ADJACENCY
    # ------------------------------------------------------------

    for data in values:

        room = data["room"]

        for wanted in room.get("adjacency", []):

            options = [
                other
                for other in values
                if other["room"]["id"] != room["id"]
                and str(other["room"].get("kind")) == str(wanted)
            ]

            if not options:
                continue

            choices = []

            for idx, other in enumerate(options):

                a = model.NewBoolVar(
                    f"{room['id']}_{other['room']['id']}_touch_l_{idx}"
                )

                b = model.NewBoolVar(
                    f"{room['id']}_{other['room']['id']}_touch_r_{idx}"
                )

                c = model.NewBoolVar(
                    f"{room['id']}_{other['room']['id']}_touch_t_{idx}"
                )

                d = model.NewBoolVar(
                    f"{room['id']}_{other['room']['id']}_touch_b_{idx}"
                )

                model.Add(data["x2"] == other["x"]).OnlyEnforceIf(a)
                model.Add(other["x2"] == data["x"]).OnlyEnforceIf(b)
                model.Add(data["y2"] == other["y"]).OnlyEnforceIf(c)
                model.Add(other["y2"] == data["y"]).OnlyEnforceIf(d)

                choices.extend([a, b, c, d])

            model.AddBoolOr(choices)


    # ------------------------------------------------------------
    # FIXED VERTICAL CORE
    # ------------------------------------------------------------

    for kind in ("stair", "lift", "lobby"):

        rect = fixed_core.get(kind)

        if not rect:
            continue

        match = next(
            (
                v for v in values
                if str(v["room"].get("kind")) == kind
            ),
            None
        )

        if not match:
            continue

        model.Add(match["x"] == ft(rect["x"]))
        model.Add(match["y"] == ft(rect["y"]))
        model.Add(match["w"] == ft(rect["w"]))
        model.Add(match["h"] == ft(rect["h"]))


    # ------------------------------------------------------------
    # OBJECTIVE
    # ------------------------------------------------------------

    penalties = []

    for data in values:

        room = data["room"]

        pref_w = ft(
            room.get(
                "preferredWidthFt",
                room.get("minWidthFt", 8)
            )
        )

        pref_h = ft(
            room.get(
                "preferredDepthFt",
                room.get("minDepthFt", 8)
            )
        )

        dw = model.NewIntVar(0, ew, f"{room['id']}_dw")
        dh = model.NewIntVar(0, eh, f"{room['id']}_dh")

        model.AddAbsEquality(dw, data["w"] - pref_w)
        model.AddAbsEquality(dh, data["h"] - pref_h)

        penalties.extend([dw, dh])

    model.Minimize(sum(penalties))


    solver = cp_model.CpSolver()

    solver.parameters.max_time_in_seconds = float(max_seconds)
    solver.parameters.num_search_workers = 8


    status = solver.Solve(model)

    if status not in (
        cp_model.OPTIMAL,
        cp_model.FEASIBLE
    ):
        return {
            "floor": floor_no,
            "success": False,
            "rooms": [],
            "score": -999999,
            "hardViolations": [
                f"CP-SAT status {solver.StatusName(status)}"
            ],
            "warnings": [],
        }


    result_rooms = []

    for rid, data in vars_by_id.items():

        room = data["room"]

        x = back(solver.Value(data["x"]))
        y = back(solver.Value(data["y"]))
        w = back(solver.Value(data["w"]))
        h = back(solver.Value(data["h"]))

        result_rooms.append({
            "id": rid,
            "name": room.get("name", rid),
            "kind": room.get("kind", "room"),
            "floor": floor_no,
            "x": x,
            "y": y,
            "w": w,
            "h": h,
            "areaSqFt": round(w * h, 2),
            "unitId": room.get("unitId"),
        })


    return {
        "floor": floor_no,
        "success": True,
        "rooms": result_rooms,
        "score": 1000,
        "hardViolations": [],
        "warnings": [],
    }


def solve_building(payload):
    started = time.time()

    envelope = payload["envelope"]
    programme = payload.get("programme", [])

    solved_floors = []

    fixed_core = {}

    for floor in programme:

        result = solve_floor(
            floor,
            envelope,
            fixed_core
        )

        solved_floors.append(result)

        if result["success"] and not fixed_core:

            for kind in ("stair", "lift", "lobby"):

                room = next(
                    (
                        r for r in result["rooms"]
                        if r.get("kind") == kind
                    ),
                    None
                )

                if room:
                    fixed_core[kind] = {
                        "x": room["x"],
                        "y": room["y"],
                        "w": room["w"],
                        "h": room["h"],
                    }


    errors = []

    for floor in solved_floors:
        for violation in floor.get("hardViolations", []):
            errors.append(
                f"Floor {floor['floor']}: {violation}"
            )


    return {
        "success": (
            len(solved_floors) > 0
            and all(
                floor["success"]
                for floor in solved_floors
            )
        ),
        "engine": "ORTOOLS_CP_SAT",
        "floors": solved_floors,
        "errors": errors,
        "warnings": [],
        "solveTimeMs": int(
            (time.time() - started) * 1000
        ),
    }


def main():

    raw = sys.stdin.read()

    if not raw.strip():
        print(
            json.dumps({
                "success": False,
                "engine": "ORTOOLS_CP_SAT",
                "floors": [],
                "errors": ["No solver input received."],
                "warnings": [],
            })
        )
        return

    try:
        payload = json.loads(raw)

        result = solve_building(payload)

        print(
            json.dumps(result)
        )

    except Exception as exc:

        print(
            json.dumps({
                "success": False,
                "engine": "ORTOOLS_CP_SAT",
                "floors": [],
                "errors": [str(exc)],
                "warnings": [],
            })
        )


if __name__ == "__main__":
    main()
