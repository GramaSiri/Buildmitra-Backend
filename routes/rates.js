const express = require("express");
const router = express.Router();
const MarketRate = require("../models/MarketRate");
const RateHistory = require("../models/RateHistory");

// Target 9 Items list
const DEFAULT_TREND_ITEMS = [
  // Materials
  { itemCode: "MAT-CEM-01", itemName: "Cement", category: "Materials", currentRate: 420, previousRate: 410, unit: "bag", city: "Bengaluru" },
  { itemCode: "MAT-STL-01", itemName: "TMT Steel", category: "Materials", currentRate: 67, previousRate: 68, unit: "kg", city: "Bengaluru" },
  { itemCode: "MAT-WIR-01", itemName: "Electrical Wires", category: "Materials", currentRate: 1850, previousRate: 1850, unit: "coil (90m)", city: "Bengaluru" },
  { itemCode: "MAT-SWT-01", itemName: "Electrical Switches", category: "Materials", currentRate: 120, previousRate: 115, unit: "piece", city: "Bengaluru" },
  { itemCode: "MAT-PIP-01", itemName: "Plumbing Pipes", category: "Materials", currentRate: 340, previousRate: 330, unit: "length (3m)", city: "Bengaluru" },
  { itemCode: "MAT-TWD-01", itemName: "Teak Wood", category: "Materials", currentRate: 2800, previousRate: 2750, unit: "cu.ft", city: "Bengaluru" },

  // Labour
  { itemCode: "LAB-MSN-01", itemName: "Mason", category: "Labour", currentRate: 950, previousRate: 900, unit: "day", city: "Bengaluru" },
  { itemCode: "LAB-HLP-01", itemName: "Helper", category: "Labour", currentRate: 650, previousRate: 650, unit: "day", city: "Bengaluru" },
  { itemCode: "LAB-CPT-01", itemName: "Carpenter", category: "Labour", currentRate: 900, previousRate: 880, unit: "day", city: "Bengaluru" },
  { itemCode: "LAB-BAR-01", itemName: "Bar Bender", category: "Labour", currentRate: 920, previousRate: 900, unit: "day", city: "Bengaluru" },
  { itemCode: "LAB-ELE-01", itemName: "Electrician", category: "Labour", currentRate: 850, previousRate: 850, unit: "day", city: "Bengaluru" },
  { itemCode: "LAB-PLM-01", itemName: "Plumber", category: "Labour", currentRate: 850, previousRate: 830, unit: "day", city: "Bengaluru" },
  { itemCode: "LAB-PNT-01", itemName: "Painter", category: "Labour", currentRate: 800, previousRate: 780, unit: "day", city: "Bengaluru" },
  { itemCode: "LAB-TIL-01", itemName: "Tile Layer", category: "Labour", currentRate: 900, previousRate: 900, unit: "day", city: "Bengaluru" },

  // Services
  { itemCode: "SRV-ARC-01", itemName: "Architectural Service", category: "Services", currentRate: 45, previousRate: 40, unit: "sq.ft", city: "Bengaluru" },
  { itemCode: "SRV-STR-01", itemName: "Structural Design", category: "Services", currentRate: 15, previousRate: 15, unit: "sq.ft", city: "Bengaluru" },
  { itemCode: "SRV-ELE-01", itemName: "Electrical Work", category: "Services", currentRate: 35, previousRate: 32, unit: "sq.ft", city: "Bengaluru" },
  { itemCode: "SRV-PLM-01", itemName: "Plumbing Work", category: "Services", currentRate: 38, previousRate: 35, unit: "sq.ft", city: "Bengaluru" },
  { itemCode: "SRV-PNT-01", itemName: "Painting Work", category: "Services", currentRate: 18, previousRate: 18, unit: "sq.ft", city: "Bengaluru" },
  { itemCode: "SRV-WTP-01", itemName: "Waterproofing", category: "Services", currentRate: 42, previousRate: 40, unit: "sq.ft", city: "Bengaluru" },
  { itemCode: "SRV-SLT-01", itemName: "Soil Testing", category: "Services", currentRate: 4500, previousRate: 4500, unit: "test", city: "Bengaluru" },
  { itemCode: "SRV-SRV-01", itemName: "Surveying", category: "Services", currentRate: 3500, previousRate: 3200, unit: "plot", city: "Bengaluru" }
];

// GET Public Approved Market Rates
router.get("/approved", async (req, res) => {
  try {
    let rates = await MarketRate.find({ approvalStatus: "approved" }).sort({ category: 1, itemName: 1 }).lean();
    if (rates.length === 0) {
      // Auto-seed default approved rates if collection is empty
      await MarketRate.insertMany(DEFAULT_TREND_ITEMS.map(i => ({ ...i, approvalStatus: "approved", approvedBy: "System Admin", approvedAt: new Date() })));
      rates = await MarketRate.find({ approvalStatus: "approved" }).sort({ category: 1, itemName: 1 }).lean();
    }
    
    // Calculate change & percentageChange
    const formattedRates = rates.map(r => {
      const change = Number((r.currentRate - r.previousRate).toFixed(2));
      const percentageChange = r.previousRate > 0 ? Number(((change / r.previousRate) * 100).toFixed(2)) : 0;
      return {
        ...r,
        change,
        percentageChange
      };
    });

    res.json({ success: true, count: formattedRates.length, rates: formattedRates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET Admin Rates Overview (Pending, Approved, Rejected)
router.get("/admin", async (req, res) => {
  try {
    const rates = await MarketRate.find({}).sort({ updatedAt: -1 }).lean();
    const history = await RateHistory.find({}).sort({ createdAt: -1 }).limit(30).lean();
    res.json({ success: true, count: rates.length, rates, history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST Admin Approve Rate
router.post("/approve", async (req, res) => {
  try {
    const { itemCode, newRate } = req.body;
    const rateDoc = await MarketRate.findOne({ itemCode });
    if (!rateDoc) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    // Save previous to history
    await RateHistory.create({
      itemCode: rateDoc.itemCode,
      itemName: rateDoc.itemName,
      category: rateDoc.category,
      subCategory: rateDoc.subCategory,
      rateType: rateDoc.rateType,
      rate: rateDoc.currentRate,
      unit: rateDoc.unit,
      city: rateDoc.city,
      state: rateDoc.state,
      sourceType: rateDoc.sourceType,
      sourceName: rateDoc.sourceName,
      effectiveDate: rateDoc.effectiveDate
    });

    const updatedCurrentRate = Number(newRate) || rateDoc.currentRate;
    rateDoc.previousRate = rateDoc.currentRate;
    rateDoc.currentRate = updatedCurrentRate;
    rateDoc.approvalStatus = "approved";
    rateDoc.approvedBy = req.body.approvedBy || "Admin";
    rateDoc.approvedAt = new Date();
    await rateDoc.save();

    res.json({ success: true, message: "Rate approved successfully", rate: rateDoc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST Admin Add/Update Rate
router.post("/add", async (req, res) => {
  try {
    const { itemCode, itemName, category, currentRate, unit, city } = req.body;
    if (!itemCode || !itemName || !currentRate || !unit) {
      return res.status(400).json({ success: false, message: "itemCode, itemName, currentRate, unit are required" });
    }

    let rateDoc = await MarketRate.findOne({ itemCode });
    if (rateDoc) {
      // Archive history
      await RateHistory.create({
        itemCode: rateDoc.itemCode,
        itemName: rateDoc.itemName,
        category: rateDoc.category,
        rate: rateDoc.currentRate,
        unit: rateDoc.unit,
        city: rateDoc.city,
        sourceType: rateDoc.sourceType,
        sourceName: rateDoc.sourceName
      });
      rateDoc.previousRate = rateDoc.currentRate;
      rateDoc.currentRate = Number(currentRate);
      rateDoc.itemName = itemName;
      rateDoc.category = category || rateDoc.category;
      rateDoc.unit = unit;
      rateDoc.city = city || rateDoc.city;
      rateDoc.approvalStatus = "approved";
      await rateDoc.save();
    } else {
      rateDoc = await MarketRate.create({
        itemCode,
        itemName,
        category: category || "Materials",
        currentRate: Number(currentRate),
        previousRate: Number(currentRate),
        unit,
        city: city || "Bengaluru",
        approvalStatus: "approved",
        sourceType: "admin_manual",
        sourceName: "BuildMitra Approved"
      });
    }

    res.json({ success: true, rate: rateDoc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
