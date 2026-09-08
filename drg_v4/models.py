from dataclasses import dataclass
from typing import List, Dict, Optional


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float


@dataclass
class RoomSpec:
    id: str
    name: str
    kind: str

    min_w: float
    pref_w: float
    max_w: float

    min_h: float
    pref_h: float
    max_h: float

    min_area: float

    floor: int

    exterior: bool = False
    plumbing: bool = False


@dataclass
class PlacedRoom:
    id: str
    name: str
    kind: str
    floor: int

    x: float
    y: float
    w: float
    h: float


@dataclass
class FloorSolution:
    floor: int
    rooms: List[PlacedRoom]
    valid: bool
    warnings: List[str]


@dataclass
class BuildingSolution:
    floors: List[FloorSolution]
    valid: bool
    warnings: List[str]
