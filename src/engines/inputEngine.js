function processInputs(input) {

  return {
    plot: {
      width: input.plotWidth || 30,
      depth: input.plotDepth || 40
    },
    constraints: {
      bedrooms: input.bedrooms || 2,
      vaastu: input.vaastu || false
    }
  };

}

module.exports = processInputs;
