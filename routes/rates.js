const express = require("express");
const router = express.Router();
const MarketRate = require("../models/MarketRate");
const RateHistory = require("../models/RateHistory");
const MarketplaceListing = require("../models/MarketplaceListing");

// Get today's YYYY-MM-DD in Asia/Kolkata
function getIndianDateStr(dateObj = new Date()) {
  const options = { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" };
  const parts = new Intl.DateTimeFormat("en-CA", options).formatToParts(dateObj);
  const year = parts.find(p => p.type === "year")?.value;
  const month = parts.find(p => p.type === "month")?.value;
  const day = parts.find(p => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

// TARGET 7 ITEM DEFINITIONS (Priority Materials & Services First)
const TARGET_ITEMS = [
  // High Priority Structural & Core Materials
  { itemCode: "MAT-CEM-01", itemName: "Cement", category: "Materials", subCategory: "Structural", unit: "bag", defaultRate: 410 },
  { itemCode: "MAT-STL-01", itemName: "TMT Steel", category: "Materials", subCategory: "Structural", unit: "kg", defaultRate: 67 },
  { itemCode: "MAT-MSND-01", itemName: "M-Sand", category: "Materials", subCategory: "Structural", unit: "cft", defaultRate: 48 },
  { itemCode: "MAT-PSND-01", itemName: "P-Sand", category: "Materials", subCategory: "Structural", unit: "cft", defaultRate: 55 },
  { itemCode: "MAT-AGG20-01", itemName: "20mm Aggregate", category: "Materials", subCategory: "Structural", unit: "cft", defaultRate: 38 },
  { itemCode: "MAT-BRK-01", itemName: "Red Bricks", category: "Materials", subCategory: "Masonry", unit: "piece", defaultRate: 11 },
  { itemCode: "MAT-BLK-01", itemName: "Concrete Blocks", category: "Materials", subCategory: "Masonry", unit: "piece", defaultRate: 42 },

  // Electrical
  { itemCode: "MAT-WIR-01", itemName: "Electrical Wires", category: "Materials", subCategory: "Electrical", unit: "coil (90m)", defaultRate: 1850 },
  { itemCode: "MAT-WIR15-01", itemName: "House Wire 1.5 sq.mm", category: "Materials", subCategory: "Electrical", unit: "coil (90m)", defaultRate: 1420 },
  { itemCode: "MAT-WIR25-01", itemName: "House Wire 2.5 sq.mm", category: "Materials", subCategory: "Electrical", unit: "coil (90m)", defaultRate: 2150 },
  { itemCode: "MAT-SWT-01", itemName: "Switches", category: "Materials", subCategory: "Electrical", unit: "piece", defaultRate: 115 },

  // Plumbing
  { itemCode: "MAT-PVC-01", itemName: "PVC Pipes", category: "Materials", subCategory: "Plumbing", unit: "length (3m)", defaultRate: 280 },
  { itemCode: "MAT-CPVC-01", itemName: "CPVC Pipes", category: "Materials", subCategory: "Plumbing", unit: "length (3m)", defaultRate: 360 },
  { itemCode: "MAT-UPVC-01", itemName: "UPVC Pipes", category: "Materials", subCategory: "Plumbing", unit: "length (3m)", defaultRate: 320 },
  { itemCode: "MAT-WTANK-01", itemName: "Water Tanks", category: "Materials", subCategory: "Plumbing", unit: "ltr", defaultRate: 8 },

  // Finishing
  { itemCode: "MAT-INTP-01", itemName: "Interior Paint", category: "Materials", subCategory: "Finishing", unit: "ltr", defaultRate: 240 },
  { itemCode: "MAT-EXTP-01", itemName: "Exterior Paint", category: "Materials", subCategory: "Finishing", unit: "ltr", defaultRate: 310 },
  { itemCode: "MAT-PUTTY-01", itemName: "Wall Putty", category: "Materials", subCategory: "Finishing", unit: "bag (40kg)", defaultRate: 780 },
  { itemCode: "MAT-VIT-01", itemName: "Vitrified Tiles", category: "Materials", subCategory: "Flooring", unit: "sq.ft", defaultRate: 58 },
  { itemCode: "MAT-GRN-01", itemName: "Granite", category: "Materials", subCategory: "Flooring", unit: "sq.ft", defaultRate: 145 },
  { itemCode: "MAT-TEAK-01", itemName: "Teak Wood", category: "Materials", subCategory: "Woodwork", unit: "cu.ft", defaultRate: 2750 },

  // Services & Labour
  { itemCode: "SRV-CIV-LOB", itemName: "Civil Labour Only", category: "Services", subCategory: "Civil Work", rateScope: "labour-only", unit: "sq.ft", defaultRate: 240 },
  { itemCode: "SRV-CIV-MAT", itemName: "Civil Labour With Material", category: "Services", subCategory: "Civil Work", rateScope: "with-material", unit: "sq.ft", defaultRate: 1850 },
  { itemCode: "SRV-CPT-LOB", itemName: "Carpentry Labour", category: "Services", subCategory: "Carpentry", rateScope: "labour-only", unit: "sq.ft", defaultRate: 180 },
  { itemCode: "SRV-CPT-INT", itemName: "Interior Carpentry", category: "Services", subCategory: "Carpentry", rateScope: "with-material", unit: "sq.ft", defaultRate: 1250 },
  { itemCode: "SRV-PLM-PNT", itemName: "Plumbing Labour per point", category: "Services", subCategory: "Plumbing", rateScope: "labour-only", unit: "point", defaultRate: 850 },
  { itemCode: "SRV-ELE-PNT", itemName: "Electrical Labour per point", category: "Services", subCategory: "Electrical", rateScope: "labour-only", unit: "point", defaultRate: 450 },
  { itemCode: "SRV-PNT-LOB", itemName: "Painting Labour", category: "Services", subCategory: "Painting", rateScope: "labour-only", unit: "sq.ft", defaultRate: 14 },
  { itemCode: "SRV-TIL-LAY", itemName: "Tile Laying", category: "Services", subCategory: "Flooring", rateScope: "labour-only", unit: "sq.ft", defaultRate: 24 },
  { itemCode: "SRV-WTP-SFT", itemName: "Waterproofing", category: "Services", subCategory: "Specialised", rateScope: "with-material", unit: "sq.ft", defaultRate: 42 }
];

async function ensureDefaultMasterRates(city = "Bengaluru") {
  for (const target of TARGET_ITEMS) {
    await MarketRate.updateOne(
      { itemCode: target.itemCode },
      {
        $setOnInsert: {
          itemCode: target.itemCode,
          itemName: target.itemName,
          category: target.category,
          subCategory: target.subCategory || "",
          rateScope: target.rateScope || "",
          currentRate: target.defaultRate,
          previousRate: target.defaultRate,
          unit: target.unit,
          city,
          approvalStatus: "approved",
          isActive: true,
          sourceType: "admin_manual",
          sourceName: "BuildMitra Admin Approved"
        }
      },
      { upsert: true }
    );
  }
}

// TARGET 8 — GET /api/rates/ticker?city=Bengaluru
router.get("/ticker", async (req, res) => {
  try {
    const city = String(req.query.city || "Bengaluru").trim();
    const todayStr = getIndianDateStr();

    await ensureDefaultMasterRates(city);

    const tickerList = [];

    for (const target of TARGET_ITEMS) {
      // Substring regex match for Marketplace listings
      const itemRegex = new RegExp(target.itemName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i");

      // Target 1: Marketplace Lowest-Rate Selection Query
      const activeListings = await MarketplaceListing.find({
        approvalStatus: "approved",
        status: { $in: ["approved", "active"] },
        isActive: true,
        isBlocked: false,
        rate: { $gt: 0 },
        providerUserCode: { $exists: true, $ne: "" },
        $or: [{ itemName: itemRegex }, { masterItemCode: target.itemCode }]
      }).lean();

      let resolvedRate = 0;
      let sourceType = "admin";
      let sourceLabel = "BuildMitra Admin Approved Rate";
      let sourceRecordId = "";
      let providerCount = 0;
      let minimumRate = 0;
      let maximumRate = 0;
      let averageRate = 0;

      if (activeListings.length > 0) {
        const rates = activeListings.map(l => l.rate).filter(r => r > 0);
        if (rates.length > 0) {
          providerCount = rates.length;
          minimumRate = Math.min(...rates);
          maximumRate = Math.max(...rates);
          averageRate = Number((rates.reduce((sum, r) => sum + r, 0) / providerCount).toFixed(2));

          resolvedRate = minimumRate;
          sourceType = "marketplace";
          sourceLabel = "Lowest Approved Marketplace Rate";
          sourceRecordId = activeListings[0]._id.toString();
        }
      }

      // Target 1 Fallback: Latest Admin-Approved Rate
      if (resolvedRate === 0) {
        const adminRate = await MarketRate.findOne({
          $or: [{ itemCode: target.itemCode }, { itemName: itemRegex }],
          approvalStatus: "approved",
          isActive: true,
          currentRate: { $gt: 0 }
        }).lean();

        if (adminRate) {
          resolvedRate = adminRate.currentRate;
          sourceType = "admin";
          sourceLabel = "BuildMitra Admin Approved Rate";
          sourceRecordId = adminRate._id.toString();
          minimumRate = resolvedRate;
          maximumRate = resolvedRate;
          averageRate = resolvedRate;
        }
      }

      // Omit item if no valid approved rate exists
      if (resolvedRate <= 0) continue;

      // Target 3: Daily Rate Snapshot Upsert into rateHistories
      await RateHistory.updateOne(
        {
          snapshotDate: todayStr,
          city,
          itemCode: target.itemCode,
          specification: target.subCategory || "",
          unit: target.unit,
          rateScope: target.rateScope || ""
        },
        {
          $set: {
            snapshotDate: todayStr,
            city,
            itemCode: target.itemCode,
            itemName: target.itemName,
            category: target.category,
            subCategory: target.subCategory || "",
            specification: target.subCategory || "",
            brand: "",
            rateScope: target.rateScope || "",
            currentRate: resolvedRate,
            unit: target.unit,
            sourceType,
            sourceLabel,
            sourceRecordId,
            providerCount,
            minimumRate,
            maximumRate,
            averageRate
          }
        },
        { upsert: true }
      );

      // Target 2: Today vs Yesterday Comparison
      const previousSnapshot = await RateHistory.findOne({
        itemCode: target.itemCode,
        city,
        unit: target.unit,
        snapshotDate: { $lt: todayStr }
      }).sort({ snapshotDate: -1 }).lean();

      let changeAmount = 0;
      let percentageChange = 0;
      let trend = "new";
      let displayColour = "neutral";
      let yesterdayRate = null;
      let comparisonDate = null;

      if (previousSnapshot && previousSnapshot.currentRate > 0) {
        yesterdayRate = previousSnapshot.currentRate;
        comparisonDate = previousSnapshot.snapshotDate;
        changeAmount = Number((resolvedRate - yesterdayRate).toFixed(2));
        percentageChange = Number(((changeAmount / yesterdayRate) * 100).toFixed(2));

        // Target 4: Construction-market colour logic
        if (resolvedRate < yesterdayRate) {
          trend = "cheaper";
          displayColour = "green"; // Cheaper is green ↓
        } else if (resolvedRate > yesterdayRate) {
          trend = "costlier";
          displayColour = "red"; // Costlier is red ↑
        } else {
          trend = "unchanged";
          displayColour = "grey"; // Unchanged is grey →
        }
      }

      tickerList.push({
        itemCode: target.itemCode,
        itemName: target.itemName,
        category: target.category,
        subCategory: target.subCategory || "",
        specification: target.subCategory || "",
        brand: "",
        rateScope: target.rateScope || "",
        city,
        todayRate: resolvedRate,
        yesterdayRate,
        comparisonDate,
        unit: target.unit,
        changeAmount,
        percentageChange: Math.abs(percentageChange),
        trend,
        displayColour,
        sourceType,
        sourceLabel,
        providerCount,
        minimumRate,
        maximumRate,
        averageRate,
        updatedAt: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      count: tickerList.length,
      city,
      date: todayStr,
      rates: tickerList.slice(0, 30) // Priority 30 items
    });
  } catch (error) {
    console.error("Ticker endpoint error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET Public Approved Market Rates (Legacy compatibility)
router.get("/approved", async (req, res) => {
  try {
    await ensureDefaultMasterRates();
    const rates = await MarketRate.find({ approvalStatus: "approved", isActive: true }).sort({ category: 1, itemName: 1 }).lean();
    res.json({ success: true, count: rates.length, rates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET Admin Rates Overview & Control
router.get("/admin", async (req, res) => {
  try {
    await ensureDefaultMasterRates();
    const rates = await MarketRate.find({}).sort({ updatedAt: -1 }).lean();
    const history = await RateHistory.find({}).sort({ createdAt: -1 }).limit(50).lean();
    const marketplaceListings = await MarketplaceListing.find({ status: "approved" }).select("itemName rate providerUserCode providerName providerCity").lean();

    res.json({
      success: true,
      count: rates.length,
      rates,
      history,
      marketplaceListingsCount: marketplaceListings.length
    });
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

    const updatedCurrentRate = Number(newRate) || rateDoc.currentRate;
    rateDoc.previousRate = rateDoc.currentRate;
    rateDoc.currentRate = updatedCurrentRate;
    rateDoc.approvalStatus = "approved";
    rateDoc.isActive = true;
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
      rateDoc.previousRate = rateDoc.currentRate;
      rateDoc.currentRate = Number(currentRate);
      rateDoc.itemName = itemName;
      rateDoc.category = category || rateDoc.category;
      rateDoc.unit = unit;
      rateDoc.city = city || rateDoc.city;
      rateDoc.approvalStatus = "approved";
      rateDoc.isActive = true;
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
        isActive: true,
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
