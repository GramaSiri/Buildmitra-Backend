const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.get("/", async (req, res) => {
  try {
    const role = String(req.query.role || "").toLowerCase();
    const roleMap = {
      labour: "laboursupply",
      laboursupply: "laboursupply",
      machine: "machinehire",
      machinery: "machinehire",
      machinehire: "machinehire",
      contractor: "contractor",
      supplier: "supplier",
      realestate: "realestate"
    };
    const providerRoles = ["contractor", "supplier", "laboursupply", "machinehire", "realestate"];
    const filter = { isMarketplaceVisible: { $ne: false } };

    if (role) {
      filter.businessRole = roleMap[role] || role;
    } else {
      filter.businessRole = { $in: providerRoles };
    }

    const users = await User.find(filter)
      .select("name email phone companyName businessRole role userCode city state address isVerified isMarketplaceVisible")
      .sort({ createdAt: -1 });

    res.json({ success: true, providers: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;


