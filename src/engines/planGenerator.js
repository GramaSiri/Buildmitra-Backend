function generateProfessionalPlan(input) {

  const plot = {
    width: input.plotWidth || 30,
    depth: input.plotDepth || 40
  };

  const rooms = [
    { id: "foyer", name: "LOBBY / FOYER", x: 5, y: 5, width: 10, depth: 12, area: 120, type: "foyer", color: "#F5F5F5", doors: [], windows: [] },
    { id: "living", name: "LIVING & DINING", x: 15, y: 5, width: 18, depth: 14, area: 252, type: "living", color: "#E3F2FD", doors: [], windows: [] },
    { id: "kitchen", name: "KITCHEN", x: 5, y: 20, width: 10, depth: 12, area: 120, type: "kitchen", color: "#FFF3E0", doors: [], windows: [] },
    { id: "master_bedroom", name: "MASTER BEDROOM", x: 20, y: 22, width: 16, depth: 14, area: 224, type: "bedroom", color: "#E8F5E9", doors: [], windows: [] },
    { id: "bedroom_2", name: "BEDROOM 2", x: 38, y: 22, width: 12, depth: 14, area: 168, type: "bedroom", color: "#F3E5F5", doors: [], windows: [] }
  ];

  return {
    plot,
    rooms,
    connectivity: {
      living: ["kitchen", "master_bedroom"],
      kitchen: ["living"],
      master_bedroom: ["living"]
    },
    statistics: {
      builtUpArea: 1248,
      carpetArea: 1060,
      circulationArea: 188
    },
    scale: 2,
    unit: "feet"
  };
}

module.exports = { generateProfessionalPlan };