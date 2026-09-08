import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def load_input(name="acceptance_test_30x40_g2.json"):
    with open(ROOT / name, "r", encoding="utf-8") as f:
        return json.load(f)


def buildable_rect(data):

    s = data["setbacks"]

    return {
        "x": float(s["left"]),
        "y": float(s["rear"]),
        "w": float(data["plotWidthFt"]) -
             float(s["left"]) -
             float(s["right"]),
        "h": float(data["plotLengthFt"]) -
             float(s["front"]) -
             float(s["rear"])
    }


def road_side(data):
    return str(data.get("facing", "North")).lower()


def parking_bay(data, buildable):

    mode = data.get("parking", "No Parking")

    if mode == "No Parking":
        return None

    facing = road_side(data)

    car_w = min(9.0, buildable["w"] * 0.40)
    car_d = min(17.0, buildable["h"] * 0.42)

    if mode == "Half Parking":

        if facing == "south":
            return {
                "x": buildable["x"],
                "y": buildable["y"],
                "w": car_w,
                "h": car_d
            }

        if facing == "north":
            return {
                "x": buildable["x"],
                "y": buildable["y"] + buildable["h"] - car_d,
                "w": car_w,
                "h": car_d
            }

        if facing == "west":
            return {
                "x": buildable["x"],
                "y": buildable["y"],
                "w": car_d,
                "h": car_w
            }

        return {
            "x": buildable["x"] + buildable["w"] - car_d,
            "y": buildable["y"],
            "w": car_d,
            "h": car_w
        }

    return dict(buildable)


def entrance_anchor(data, buildable, parking):

    facing = road_side(data)

    door_w = 4.0
    depth = 4.0

    if facing == "south":

        x = buildable["x"] + buildable["w"] * 0.65

        if parking:
            x = max(
                x,
                parking["x"] +
                parking["w"] +
                1.5
            )

        return {
            "x": min(
                x,
                buildable["x"] +
                buildable["w"] -
                door_w
            ),
            "y": buildable["y"],
            "w": door_w,
            "h": depth
        }

    if facing == "north":

        return {
            "x": buildable["x"] + buildable["w"] * 0.60,
            "y": buildable["y"] + buildable["h"] - depth,
            "w": door_w,
            "h": depth
        }

    if facing == "west":

        return {
            "x": buildable["x"],
            "y": buildable["y"] + buildable["h"] * 0.60,
            "w": depth,
            "h": door_w
        }

    return {
        "x": buildable["x"] + buildable["w"] - depth,
        "y": buildable["y"] + buildable["h"] * 0.60,
        "w": depth,
        "h": door_w
    }
