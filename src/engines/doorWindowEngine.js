function doorWindowEngine(rooms, connectivity = {}) {

  return rooms.map(room => {

    let doors = [];
    let windows = [];

    const name = room.name.toLowerCase();

    // -------------------------
    // 🚪 DOOR LOGIC (ADVANCED)
    // -------------------------

    if (name.includes("hall")) {
      doors.push({ side: "E", type: "main_entry" });
    }

    if (name.includes("kitchen")) {
      doors.push({ side: "W", connectsTo: "hall" });
    }

    if (name.includes("bedroom")) {
      doors.push({ side: "W", connectsTo: "hall" });
    }

    if (name.includes("toilet")) {
      doors.push({ side: "S", connectsTo: "bedroom" });
    }

    // -------------------------
    // 🪟 WINDOW LOGIC (ADVANCED)
    // -------------------------

    if (name.includes("kitchen")) {
      windows.push({ side: "SE", size: "large", type: "ventilation" });
    }

    if (name.includes("bedroom")) {
      windows.push({ side: "E", size: "medium", type: "light" });
      windows.push({ side: "N", size: "small", type: "air" });
    }

    if (name.includes("hall")) {
      windows.push({ side: "N", size: "large", type: "lighting" });
      windows.push({ side: "E", size: "large", type: "ventilation" });
    }

    if (name.includes("toilet")) {
      windows.push({ side: "W", size: "small", type: "exhaust" });
    }

    return {
      ...room,
      doors,
      windows
    };
  });
}

module.exports = doorWindowEngine;
