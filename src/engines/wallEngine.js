function buildSharedWalls(rooms) {

  let walls = [];
  const wallSet = new Set();

  function addWall(key, wall) {
    if (!wallSet.has(key)) {
      wallSet.add(key);
      walls.push(wall);
    }
  }

  rooms.forEach((r) => {

    const t = 6;

    // LEFT
    addWall(r.name + "_L",
      { x: r.x, y: r.y, width: t, height: r.height });

    // RIGHT
    addWall(r.name + "_R",
      { x: r.x + r.width, y: r.y, width: t, height: r.height });

    // TOP
    addWall(r.name + "_T",
      { x: r.x, y: r.y, width: r.width, height: t });

    // BOTTOM
    addWall(r.name + "_B",
      { x: r.x, y: r.y + r.height, width: r.width, height: t });

  });

  // REMOVE DUPLICATE OVERLAPPING WALLS (SHARED LOGIC)
  const filtered = [];

  walls.forEach((w, i) => {
    const key = `${Math.round(w.x)}_${Math.round(w.y)}_${w.width}_${w.height}`;

    if (!wallSet.has(key)) {
      wallSet.add(key);
      filtered.push(w);
    }
  });

  return walls;
}

module.exports = buildSharedWalls;
