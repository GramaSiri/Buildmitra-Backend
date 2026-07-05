function roomRulesEngine(zoned) {

  const b = zoned.constraints.bedrooms || 2;

  let rooms = [];

  // ENTRY (FOYER ALWAYS FIRST)
  rooms.push({
    name: "Foyer",
    width: 140,
    height: 120,
    zone: "entry",
    vaastu: "North-East",
    x: 20,
    y: 20
  });

  // LIVING (CENTER CORE)
  rooms.push({
    name: "Living",
    width: 280,
    height: 200,
    zone: "living",
    vaastu: "Center-East",
    x: 180,
    y: 20
  });

  // BEDROOMS (SW ZONE)
  for (let i = 1; i <= b; i++) {
    rooms.push({
      name: `Bedroom ${i}`,
      width: 220,
      height: 160,
      zone: "bedroom",
      vaastu: "South-West",
      x: 20,
      y: 250 + (i * 180)
    });
  }

  // KITCHEN (SE STRICT RULE)
  rooms.push({
    name: "Kitchen",
    width: 160,
    height: 140,
    zone: "kitchen",
    vaastu: "South-East",
    x: 480,
    y: 20
  });

  // TOILET (NW RULE)
  rooms.push({
    name: "Toilet",
    width: 120,
    height: 100,
    zone: "toilet",
    vaastu: "North-West",
    x: 480,
    y: 200
  });

  return rooms;
}

module.exports = roomRulesEngine;
