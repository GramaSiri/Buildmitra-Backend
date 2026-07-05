const express = require("express");
const router = express.Router();
const generatePlan = require("../engines/planGenerator");

router.post("/generate", (req, res) => {

  const result = generatePlan(req.body);

  // ?? FINAL RAW DUMP
  console.log("?? FINAL ENGINE OUTPUT:", JSON.stringify(result, null, 2));

  res.json(result);
});

module.exports = router;
