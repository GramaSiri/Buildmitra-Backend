function layoutEngine(data) {

  const rooms = data?.rooms || [];

  if (!Array.isArray(rooms)) return [];

  return rooms.map((r, index) => {

    const baseX = index * 180;

    return {
      id: r.name.toLowerCase().replace(/\s/g, "_"),
      name: r.name,

      x: baseX + (r.zone === "SE" ? 200 : 0),
      y: r.zone === "SW" ? 250 : 100,

      width: 150,
      height: 120,

      zone: r.zone || "CENTER",

      type:
        r.name.includes("Kitchen") ? "kitchen" :
        r.name.includes("Bedroom") ? "bedroom" :
        r.name.includes("Toilet") ? "toilet" :
        "living",

      doors: [],
      windows: []
    };
  });
}

module.exports = layoutEngine;
