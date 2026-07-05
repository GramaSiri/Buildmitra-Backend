console.log("🔥 CONNECTIVITY MODULE LOADED:", __filename);

function connectivityGraph(input) {

  console.log("🔥 CONNECTIVITY FUNCTION EXECUTED");

  return {
    hall: ["kitchen", "bedroom_1"],
    kitchen: ["hall"],
    bedroom_1: ["hall"]
  };
}

module.exports = connectivityGraph;
