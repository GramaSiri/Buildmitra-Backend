function zoningEngine(data) {

  const result = {
    plot: {
      width: data.plot.width,
      depth: data.plot.depth
    },

    constraints: {
      bedrooms: data.constraints.bedrooms,
      vaastu: data.constraints.vaastu
    },

    zones: {
      entry: "foyer",
      living: "center",
      kitchen: "south-east",
      bedroom: "south-west",
      toilet: "west",
      pooja: "north-east"
    }
  };

  return result;
}

module.exports = zoningEngine;
