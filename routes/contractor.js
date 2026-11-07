const express = require("express");
const router = express.Router();
const ContractorData = require("../models/ContractorData");

function escapeRegex(str) {
  return String(str || "").replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

// Get contractor data
router.get("/data/:userCode", async (req, res) => {
  try {
    const userCode = String(req.params.userCode || "").trim();
    if (!userCode) return res.json({ success: true, data: null });

    const regex = new RegExp(`^${escapeRegex(userCode)}$`, "i");
    let data = await ContractorData.findOne({ userCode: regex });

    if (!data) {
      data = {
        userCode,
        companyProfile: {},
        customLocations: [],
        quotes: [],
        companyDocs: [],
        labourMasterList: []
      };
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error("Get contractor data error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Save contractor data
router.post("/data/:userCode", async (req, res) => {
  try {
    const userCode = String(req.params.userCode || req.headers["x-user-code"] || "").trim();
    if (!userCode) return res.status(400).json({ success: false, message: "userCode is required" });

    const regex = new RegExp(`^${escapeRegex(userCode)}$`, "i");

    const updateFields = {};
    if (req.body.companyProfile !== undefined) updateFields.companyProfile = req.body.companyProfile;
    if (req.body.customLocations !== undefined) updateFields.customLocations = req.body.customLocations;
    if (req.body.quotes !== undefined) updateFields.quotes = req.body.quotes;
    if (req.body.companyDocs !== undefined) updateFields.companyDocs = req.body.companyDocs;
    if (req.body.labourMasterList !== undefined) updateFields.labourMasterList = req.body.labourMasterList;

    const data = await ContractorData.findOneAndUpdate(
      { userCode: regex },
      { $set: { ...updateFields, userCode } },
      { new: true, upsert: true }
    );

    res.json({ success: true, data });
  } catch (error) {
    console.error("Save contractor data error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
