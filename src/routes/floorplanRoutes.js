const express = require("express");
const router = express.Router();
const generatePlan = require("../engines/planGenerator");

router.post("/generate", (req, res) => {

  console.log("🔥 ROUTE HIT");
  console.log("🔥 BODY:", req.body);

  const result = generatePlan(req.body);

  console.log("🔥 RESULT FROM ENGINE:", JSON.stringify(result, null, 2));

  if (!result) {
    return res.json({
      success: false,
      message: "Engine returned empty result",
      data: null
    });
  }

  return res.json({
    success: true,
    message: "AI Floorplan Generated",
    data: result
  });
});

module.exports = router;
