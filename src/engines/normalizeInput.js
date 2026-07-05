function normalizeInput(input) {

  console.log("?? RAW INPUT INSIDE NORMALIZE:", input);

  const result = {
    plot: {
      width: Number(input?.plotWidth || 0),
      depth: Number(input?.plotDepth || 0)
    },
    constraints: {
      bedrooms: Number(input?.bedrooms || 0),
      vaastu: Boolean(input?.vaastu || false)
    }
  };

  console.log("?? NORMALIZED RESULT:", result);

  return result;
}

module.exports = normalizeInput;
