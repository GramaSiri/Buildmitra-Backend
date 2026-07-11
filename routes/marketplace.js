const express = require("express");
const router = express.Router();
const MarketplaceListing = require("../models/MarketplaceListing");

router.get("/", async (req, res) => {
  try {
    const filter = {
      status: "approved",
      isActive: true,
      isBlocked: false
    };

    if (req.query.itemType) filter.itemType = req.query.itemType;
    if (req.query.category) filter.category = new RegExp(req.query.category, "i");
    if (req.query.city) filter.providerCity = new RegExp(req.query.city, "i");
    if (req.query.pincode) filter.providerPincode = String(req.query.pincode);

    if (req.query.search) {
      const s = new RegExp(req.query.search, "i");
      filter.$or = [
        { itemName: s },
        { brand: s },
        { category: s },
        { subCategory: s },
        { providerName: s },
        { providerCity: s },
        { location: s }
      ];
    }

    const sort = req.query.sort === "lowest" ? { rate: 1 } : { createdAt: -1 };

    const items = await MarketplaceListing.find(filter).sort(sort).limit(300);

    res.json({
      success: true,
      count: items.length,
      items,
      listings: items
    });
  } catch (err) {
    console.error("Marketplace route error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
