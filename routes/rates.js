const express = require("express");
const router = express.Router();
const MarketRate = require("../models/MarketRate");
const MasterItem = require("../models/MasterItem");
const RateHistory = require("../models/RateHistory");
const MarketplaceListing = require("../models/MarketplaceListing");

function getIndianDateStr(dateObj = new Date()) {
  const options = { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" };
  const parts = new Intl.DateTimeFormat("en-CA", options).formatToParts(dateObj);
  const year = parts.find(p => p.type === "year")?.value;
  const month = parts.find(p => p.type === "month")?.value;
  const day = parts.find(p => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function normalizeUnit(unit) {
  if (!unit) return "";
  const u = String(unit).trim().toUpperCase();
  if (["KG", "KGS", "KILOGRAM", "KILOGRAMS"].includes(u)) return "KG";
  if (["BAG", "BAGS", "BAG (50KG)"].includes(u)) return "BAG";
  if (["CFT", "CU.FT", "CUFT", "CUBIC FEET", "CUBIC FOOT"].includes(u)) return "CFT";
  if (["SQFT", "SQ.FT", "SFT", "SQUARE FEET", "SQ FT"].includes(u)) return "SQFT";
  if (["RFT", "RUNNING FEET", "RUNNING FOOT"].includes(u)) return "RFT";
  if (["NOS", "NO", "NUMBERS", "NUMBER", "PIECE", "PIECES", "NOS.", "PKT", "PACKET"].includes(u)) return "NOS";
  if (["LTR", "LITRE", "LITER", "LITRES", "LITERS"].includes(u)) return "LTR";
  if (["M", "METER", "METRE", "METERS"].includes(u)) return "M";
  if (["CUM", "CU.M", "CUBIC METER"].includes(u)) return "CUM";
  if (["MT", "TON", "TONNE", "METRIC TON"].includes(u)) return "MT";
  return u;
}

const TARGET_ITEMS = [
  { itemCode: "MAT-CEM-01", itemName: "Cement (OPC 53)", category: "Materials", subCategory: "Structural", unit: "BAG", defaultRate: 385 },
  { itemCode: "MAT-STL-01", itemName: "TMT Steel", category: "Materials", subCategory: "Structural", unit: "KG", defaultRate: 67 },
  { itemCode: "MAT-MSND-01", itemName: "M-Sand", category: "Materials", subCategory: "Structural", unit: "CFT", defaultRate: 45 },
  { itemCode: "MAT-VIT-01", itemName: "Vitrified Tiles (600x600)", category: "Materials", subCategory: "Flooring", unit: "SQFT", defaultRate: 65 },
  { itemCode: "MAT-CER-01", itemName: "Ceramic Tiles", category: "Materials", subCategory: "Flooring", unit: "SQFT", defaultRate: 45 },
  { itemCode: "MAT-GRN-01", itemName: "Granite Slab", category: "Materials", subCategory: "Flooring", unit: "SQFT", defaultRate: 165 },
  { itemCode: "MAT-MRB-01", itemName: "Marble Slab", category: "Materials", subCategory: "Flooring", unit: "SQFT", defaultRate: 220 },
  { itemCode: "MAT-KOT-01", itemName: "Kota Stone", category: "Materials", subCategory: "Flooring", unit: "SQFT", defaultRate: 75 },
  { itemCode: "MAT-TAN-01", itemName: "Tandur Stone", category: "Materials", subCategory: "Flooring", unit: "SQFT", defaultRate: 68 },
  { itemCode: "MAT-PRK-01", itemName: "Parking Tiles", category: "Materials", subCategory: "Flooring", unit: "SQFT", defaultRate: 52 },
  { itemCode: "MAT-WDN-01", itemName: "Wooden Flooring", category: "Materials", subCategory: "Flooring", unit: "SQFT", defaultRate: 125 },
  { itemCode: "MAT-VNY-01", itemName: "Vinyl Flooring", category: "Materials", subCategory: "Flooring", unit: "SQFT", defaultRate: 85 },
  { itemCode: "MAT-ADH-01", itemName: "Tile Adhesive (20kg)", category: "Materials", subCategory: "Flooring Accessories", unit: "BAG", defaultRate: 450 },
  { itemCode: "MAT-GRT-01", itemName: "Tile Grout", category: "Materials", subCategory: "Flooring Accessories", unit: "KG", defaultRate: 65 },
  { itemCode: "MAT-SPC-01", itemName: "Tile Spacers (100 pcs)", category: "Materials", subCategory: "Flooring Accessories", unit: "NOS", defaultRate: 120 },
  { itemCode: "SRV-TIL-LAY", itemName: "Tile Laying Labour", category: "Services", subCategory: "Flooring", unit: "SQFT", defaultRate: 24 },
  { itemCode: "SRV-GRN-LAY", itemName: "Granite Laying Labour", category: "Services", subCategory: "Flooring", unit: "SQFT", defaultRate: 38 },
  { itemCode: "SRV-MRB-LAY", itemName: "Marble Laying Labour", category: "Services", subCategory: "Flooring", unit: "SQFT", defaultRate: 45 },
  { itemCode: "SRV-CLD-LAY", itemName: "Wall Cladding Labour", category: "Services", subCategory: "Flooring", unit: "SQFT", defaultRate: 30 },
  { itemCode: "SRV-SKT-LAY", itemName: "Skirting Fixing Labour", category: "Services", subCategory: "Flooring", unit: "RFT", defaultRate: 15 },
  { itemCode: "MAT-PUT-01", itemName: "Wall Putty", category: "Materials", subCategory: "Painting", unit: "KG", defaultRate: 19.50 },
  { itemCode: "MAT-PRM-01", itemName: "Wall Primer", category: "Materials", subCategory: "Painting", unit: "LTR", defaultRate: 160 },
  { itemCode: "MAT-PNT-01", itemName: "Emulsion Paint", category: "Materials", subCategory: "Painting", unit: "LTR", defaultRate: 235 },
  { itemCode: "MAT-PNT-ROY", itemName: "Royal Luxury Paint", category: "Materials", subCategory: "Painting", unit: "LTR", defaultRate: 380 },
  { itemCode: "MAT-PNT-EXT", itemName: "Exterior Weatherproof Paint", category: "Materials", subCategory: "Painting", unit: "LTR", defaultRate: 285 },
  { itemCode: "MAT-ENM-01", itemName: "Enamel Paint", category: "Materials", subCategory: "Painting", unit: "LTR", defaultRate: 240 },
  { itemCode: "MAT-PNT-CEL", itemName: "Ceiling Paint", category: "Materials", subCategory: "Painting", unit: "LTR", defaultRate: 180 },
  { itemCode: "MAT-PNT-TXT", itemName: "Texture Paint", category: "Materials", subCategory: "Painting", unit: "KG", defaultRate: 95 },
  { itemCode: "SRV-PNT-LAY", itemName: "Painting Labour", category: "Services", subCategory: "Painting", unit: "SQFT", defaultRate: 14 },
  { itemCode: "MAT-WTR-01", itemName: "Construction Water Supply", category: "Materials", subCategory: "Site Utilities", unit: "LTR", defaultRate: 0.05 },
  { itemCode: "MAT-WPR-01", itemName: "Waterproofing Liquid Compound", category: "Materials", subCategory: "Plastering Accessories", unit: "LTR", defaultRate: 135 },
  { itemCode: "SRV-PLS-LAY", itemName: "Plastering Labour", category: "Services", subCategory: "Plastering", unit: "SQFT", defaultRate: 18 },
  { itemCode: "MAT-BRK-01", itemName: "Clay Bricks", category: "Materials", subCategory: "Masonry", unit: "NOS", defaultRate: 7.50 },
  { itemCode: "MAT-BLK-01", itemName: "Concrete Solid Blocks", category: "Materials", subCategory: "Masonry", unit: "NOS", defaultRate: 45 },
  { itemCode: "MAT-AAC-01", itemName: "AAC Blocks", category: "Materials", subCategory: "Masonry", unit: "NOS", defaultRate: 75 },
  { itemCode: "SRV-BRK-LAY", itemName: "Brickwork Masonry Labour", category: "Services", subCategory: "Masonry", unit: "SQFT", defaultRate: 12 },
  { itemCode: "MAT-CEM-01", itemName: "Cement OPC 53 Grade", category: "Materials", subCategory: "Concrete", unit: "BAG", defaultRate: 385 },
  { itemCode: "MAT-STL-01", itemName: "TMT Steel Rebar Fe 500D", category: "Materials", subCategory: "Steel", unit: "KG", defaultRate: 68 },
  { itemCode: "MAT-MSND-01", itemName: "M-Sand", category: "Materials", subCategory: "Concrete", unit: "CFT", defaultRate: 46 },
  { itemCode: "MAT-AGG-20", itemName: "20mm Aggregate", category: "Materials", subCategory: "Concrete", unit: "CFT", defaultRate: 40 },
  { itemCode: "MAT-AGG-12", itemName: "12mm Aggregate", category: "Materials", subCategory: "Concrete", unit: "CFT", defaultRate: 42 },
  { itemCode: "MAT-BWR-01", itemName: "Steel Binding Wire", category: "Materials", subCategory: "Steel Accessories", unit: "KG", defaultRate: 80 },
  { itemCode: "MAT-CVR-01", itemName: "Concrete Cover Blocks", category: "Materials", subCategory: "Concrete Accessories", unit: "NOS", defaultRate: 5 },
  { itemCode: "SRV-RCC-LAY", itemName: "RCC Casting Labour", category: "Services", subCategory: "Concrete", unit: "CUM", defaultRate: 1000 },
  { itemCode: "MAT-DOR-01", itemName: "Flush Door & Frame Set", category: "Materials", subCategory: "Openings", unit: "NOS", defaultRate: 4500 },
  { itemCode: "MAT-WIN-01", itemName: "UPVC Sliding Window & Chajja Set", category: "Materials", subCategory: "Openings", unit: "NOS", defaultRate: 3500 },
  { itemCode: "MAT-ELE-01", itemName: "Concealed Electrical Conduits & Boxes", category: "Materials", subCategory: "MEP", unit: "SQFT", defaultRate: 45 },
  { itemCode: "MAT-PLM-01", itemName: "Concealed Plumbing CPVC/SWR Lines", category: "Materials", subCategory: "MEP", unit: "SQFT", defaultRate: 35 },
  { itemCode: "SRV-BLD-LAY", itemName: "Full Building Civil Construction Labour", category: "Services", subCategory: "Building Civil", unit: "SQFT", defaultRate: 240 },
  { itemCode: "MAT-TIL-01", itemName: "Vitrified Flooring & Wall Tiles", category: "Materials", subCategory: "Finishes", unit: "SQFT", defaultRate: 65 },
  { itemCode: "MAT-SAN-01", itemName: "Sanitaryware & CP Fittings Bathroom Set", category: "Materials", subCategory: "Plumbing", unit: "SET", defaultRate: 18500 },
  { itemCode: "MAT-RLG-01", itemName: "SS Railings & Main MS Gate Set", category: "Materials", subCategory: "Fabrication", unit: "SQFT", defaultRate: 45 },
  { itemCode: "MAT-CWD-01", itemName: "Perimeter Compound Wall Masonry & Plaster", category: "Materials", subCategory: "Civil Outer", unit: "SQFT", defaultRate: 350 },
  { itemCode: "MAT-OHT-01", itemName: "Overhead Water Tank OHT 1000L", category: "Materials", subCategory: "Utilities", unit: "NOS", defaultRate: 8500 },
  { itemCode: "MAT-UGT-01", itemName: "Underground Sump Tank & Water Pump Set", category: "Materials", subCategory: "Utilities", unit: "SET", defaultRate: 45000 },
  { itemCode: "SRV-TRN-LAY", itemName: "Turnkey Finishing Labour", category: "Services", subCategory: "Finishing", unit: "SQFT", defaultRate: 160 },
  { itemCode: "SRV-COL-SHT", itemName: "Column Steel/Ply Shuttering Box Rental & Fixing", category: "Services", subCategory: "Formwork", unit: "SQFT", defaultRate: 35 },
  { itemCode: "SRV-BEM-SHT", itemName: "Beam Steel/Ply Formwork Rental & Fixing", category: "Services", subCategory: "Formwork", unit: "SQFT", defaultRate: 35 },
  { itemCode: "SRV-EXC-01", itemName: "Earthwork Pit Excavation Labour/JCB", category: "Services", subCategory: "Earthwork", unit: "CUM", defaultRate: 80 },
  { itemCode: "SRV-FTG-SHT", itemName: "Footing Steel/Ply Formwork Rental & Fixing", category: "Services", subCategory: "Formwork", unit: "SQFT", defaultRate: 35 },
  { itemCode: "SRV-STR-SHT", itemName: "Staircase Formwork Shuttering Rental & Fixing", category: "Services", subCategory: "Formwork", unit: "SQFT", defaultRate: 35 },
  { itemCode: "MAT-STR-FIN", itemName: "Granite/Tile Step Tread & Riser Finish", category: "Materials", subCategory: "Finishes", unit: "SQFT", defaultRate: 120 },
  { itemCode: "MAT-STR-RLG", itemName: "MS/SS Staircase Railing", category: "Materials", subCategory: "Fabrication", unit: "RMT", defaultRate: 850 },
  { itemCode: "MAT-FDP-01", itemName: "Food Grade Non-Toxic Tank Epoxy Paint", category: "Materials", subCategory: "Coatings", unit: "SQFT", defaultRate: 35 },
  { itemCode: "MAT-FRP-01", itemName: "FRP Manhole Cover 2ft x 2ft", category: "Materials", subCategory: "Accessories", unit: "NOS", defaultRate: 1000 },
  { itemCode: "SRV-TNK-SHT", itemName: "Water Tank Formwork Shuttering Rental & Fixing", category: "Services", subCategory: "Formwork", unit: "SQFT", defaultRate: 35 },
  { itemCode: "MAT-PVC-01", itemName: "PVC Inlet/Outlet Sleeves & Vent Pipe Set", category: "Materials", subCategory: "Plumbing", unit: "SET", defaultRate: 450 },
  { itemCode: "SRV-SEP-SHT", itemName: "Septic Tank Formwork Shuttering Rental & Fixing", category: "Services", subCategory: "Formwork", unit: "SQFT", defaultRate: 35 },
  { itemCode: "MAT-SSM-01", itemName: "Size Stones SS Masonry", category: "Materials", subCategory: "Masonry", unit: "CFT", defaultRate: 38 },
  { itemCode: "MAT-WPH-01", itemName: "PVC Drainage Weepholes 75mm", category: "Materials", subCategory: "Accessories", unit: "NOS", defaultRate: 120 },
  { itemCode: "SRV-RET-SHT", itemName: "Retaining Wall Formwork Shuttering Rental & Fixing", category: "Services", subCategory: "Formwork", unit: "SQFT", defaultRate: 35 },
  { itemCode: "MAT-ROF-SHT", itemName: "Metal GI/Galvalume Roof Sheeting", category: "Materials", subCategory: "Roofing", unit: "SQFT", defaultRate: 45 },
  { itemCode: "MAT-ROF-PNT", itemName: "Anti-Corrosive Primer & Enamel Paint Coating", category: "Materials", subCategory: "Coatings", unit: "SQFT", defaultRate: 15 },
  { itemCode: "SRV-TRU-LAB", itemName: "Roof Truss Fabrication & Erection Labour", category: "Services", subCategory: "Fabrication", unit: "KG", defaultRate: 12 },
  { itemCode: "SRV-PIL-BOR", itemName: "Auger Pit Boring Labour & Rig Charges", category: "Services", subCategory: "Boring", unit: "RMT", defaultRate: 450 },
  { itemCode: "SRV-LNT-SHT", itemName: "Lintel Formwork Shuttering Rental & Fixing", category: "Services", subCategory: "Formwork", unit: "SQFT", defaultRate: 35 },
  { itemCode: "MAT-PLY-18", itemName: "18mm BWP/BWR Plywood", category: "Materials", subCategory: "Plywood", unit: "SQFT", defaultRate: 80 },
  { itemCode: "MAT-PLY-12", itemName: "12mm BWP Plywood", category: "Materials", subCategory: "Plywood", unit: "SQFT", defaultRate: 65 },
  { itemCode: "MAT-PLY-06", itemName: "6mm MR Plywood", category: "Materials", subCategory: "Plywood", unit: "SQFT", defaultRate: 40 },
  { itemCode: "MAT-LAM-EXT", itemName: "External Decorative Laminate 1.0mm", category: "Materials", subCategory: "Laminates", unit: "SQFT", defaultRate: 45 },
  { itemCode: "MAT-LAM-INT", itemName: "Internal Liner Laminate 0.8mm", category: "Materials", subCategory: "Laminates", unit: "SQFT", defaultRate: 30 },
  { itemCode: "MAT-EDG-BND", itemName: "PVC Edge Banding Tape 2mm", category: "Materials", subCategory: "Hardware", unit: "M", defaultRate: 8 },
  { itemCode: "MAT-COR-BED", itemName: "PVC/Aluminium Corner Beads", category: "Materials", subCategory: "Hardware", unit: "M", defaultRate: 15 },
  { itemCode: "MAT-HNG-SFT", itemName: "Soft-Close 3D Hydraulic Hinges", category: "Materials", subCategory: "Hardware", unit: "NOS", defaultRate: 35 },
  { itemCode: "MAT-HND-DES", itemName: "Designer Handles & Profile Pulls", category: "Materials", subCategory: "Hardware", unit: "NOS", defaultRate: 50 },
  { itemCode: "MAT-LCK-MRT", itemName: "Mortise & Cylinder Locks", category: "Materials", subCategory: "Hardware", unit: "NOS", defaultRate: 120 },
  { itemCode: "MAT-DRW-CHN", itemName: "Tandem Box / Soft-Close Drawer Channels", category: "Materials", subCategory: "Hardware", unit: "SET", defaultRate: 80 },
  { itemCode: "MAT-SLD-TRK", itemName: "Sliding Wardrobe Roller Tracks", category: "Materials", subCategory: "Hardware", unit: "RFT", defaultRate: 250 },
  { itemCode: "MAT-SS304-BSK", itemName: "Modular SS 304 Kitchen Baskets", category: "Materials", subCategory: "Hardware", unit: "SET", defaultRate: 450 },
  { itemCode: "MAT-FEV-ADH", itemName: "Fevicol D3 Synthetic Resin Adhesive", category: "Materials", subCategory: "Consumables", unit: "KG", defaultRate: 60 },
  { itemCode: "MAT-NLS-FST", itemName: "Nails & Fasteners", category: "Materials", subCategory: "Consumables", unit: "KG", defaultRate: 30 },
  { itemCode: "MAT-SCR-WLL", itemName: "Consumable Screws & Plugs", category: "Materials", subCategory: "Consumables", unit: "BOX", defaultRate: 40 },
  { itemCode: "MAT-MIR-01", itemName: "Mirrors 5mm Float Glass", category: "Materials", subCategory: "Glass", unit: "SQFT", defaultRate: 50 }
];

async function ensureDefaultMasterRates(city = "Bengaluru") {
  for (const target of TARGET_ITEMS) {
    await MarketRate.updateOne(
      { itemCode: target.itemCode, city },
      {
        $setOnInsert: {
          masterItemCode: target.itemCode,
          itemCode: target.itemCode,
          itemName: target.itemName,
          category: target.category,
          subCategory: target.subCategory || "",
          currentRate: target.defaultRate,
          previousRate: target.defaultRate,
          unit: normalizeUnit(target.unit),
          city,
          state: "Karnataka",
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

// GET /api/rates/ticker
router.get("/ticker", async (req, res) => {
  try {
    const city = String(req.query.city || "Bengaluru").trim();
    const todayStr = getIndianDateStr();
    await ensureDefaultMasterRates(city);

    const tickerList = [];
    for (const target of TARGET_ITEMS) {
      const itemRegex = new RegExp(target.itemName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i");
      const activeListings = await MarketplaceListing.find({
        approvalStatus: "approved",
        status: { $in: ["approved", "active"] },
        isActive: true,
        isBlocked: false,
        rate: { $gt: 0 },
        $or: [{ itemName: itemRegex }, { masterItemCode: target.itemCode }]
      }).lean();

      let resolvedRate = 0;
      let sourceType = "admin";
      let sourceLabel = "BuildMitra Admin Reference Rate";

      if (activeListings.length > 0) {
        const rates = activeListings.map(l => l.rate).filter(r => r > 0);
        if (rates.length > 0) {
          resolvedRate = Math.min(...rates);
          sourceType = "marketplace";
          sourceLabel = "Lowest Approved Marketplace Rate";
        }
      }

      if (resolvedRate === 0) {
        const adminRate = await MarketRate.findOne({
          $or: [{ masterItemCode: target.itemCode }, { itemCode: target.itemCode }, { itemName: itemRegex }],
          approvalStatus: "approved",
          isActive: true,
          currentRate: { $gt: 0 }
        }).lean();

        if (adminRate) {
          resolvedRate = adminRate.currentRate;
          sourceType = "admin";
          sourceLabel = "BuildMitra Admin Approved Rate";
        } else {
          resolvedRate = target.defaultRate;
        }
      }

      const prevRate = target.defaultRate;
      const changeAmt = resolvedRate - prevRate;
      const pctChange = prevRate > 0 ? Number(((changeAmt / prevRate) * 100).toFixed(2)) : 0;
      const trend = changeAmt < 0 ? "cheaper" : changeAmt > 0 ? "costlier" : "new";

      tickerList.push({
        itemCode: target.itemCode,
        itemName: target.itemName,
        category: target.category,
        subCategory: target.subCategory || "",
        city,
        todayRate: resolvedRate,
        yesterdayRate: prevRate,
        changeAmount: isNaN(changeAmt) ? 0 : changeAmt,
        percentageChange: isNaN(pctChange) ? 0 : pctChange,
        trend: isNaN(pctChange) || pctChange === 0 ? "new" : trend,
        unit: normalizeUnit(target.unit),
        sourceType,
        sourceLabel,
        updatedAt: new Date().toISOString()
      });
    }

    res.json({ success: true, count: tickerList.length, city, date: todayStr, rates: tickerList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/rates/approved (Public & Calculators)
router.get("/approved", async (req, res) => {
  try {
    await ensureDefaultMasterRates();
    const rates = await MarketRate.find({ approvalStatus: "approved", isActive: true }).sort({ category: 1, itemName: 1 }).lean();
    res.json({ success: true, count: rates.length, rates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/rates/admin (Admin Dashboard)
router.get("/admin", async (req, res) => {
  try {
    await ensureDefaultMasterRates();
    const filter = {};

    if (req.query.search) {
      const q = String(req.query.search).trim();
      const regex = new RegExp(q, "i");
      filter.$or = [
        { masterItemCode: regex },
        { itemCode: regex },
        { itemName: regex },
        { category: regex },
        { subCategory: regex },
        { brand: regex },
        { specification: regex }
      ];
    }

    if (req.query.category && req.query.category !== "all") {
      filter.category = new RegExp(String(req.query.category).trim(), "i");
    }

    if (req.query.itemType && req.query.itemType !== "all") {
      filter.itemType = String(req.query.itemType).trim().toLowerCase();
    }

    if (req.query.status && req.query.status !== "all") {
      if (req.query.status === "active") filter.isActive = true;
      if (req.query.status === "inactive") filter.isActive = false;
    }

    if (req.query.approvalStatus && req.query.approvalStatus !== "all") {
      filter.approvalStatus = String(req.query.approvalStatus).trim().toLowerCase();
    }

    const rates = await MarketRate.find(filter).sort({ updatedAt: -1 }).lean();
    const history = await RateHistory.find({}).sort({ createdAt: -1 }).limit(50).lean();

    const masterCodes = rates.map(r => r.masterItemCode || r.itemCode).filter(Boolean);
    const listingCounts = await MarketplaceListing.aggregate([
      { $match: { masterItemCode: { $in: masterCodes } } },
      { $group: { _id: "$masterItemCode", count: { $sum: 1 } } }
    ]);
    const listingMap = {};
    listingCounts.forEach(l => { listingMap[l._id] = l.count; });

    const formatted = rates.map(r => {
      const code = r.masterItemCode || r.itemCode;
      return {
        ...r,
        providerCount: listingMap[code] || 0
      };
    });

    res.json({ success: true, count: formatted.length, rates: formatted, history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const { resolveBulkRates, resolveSingleRate } = require("../services/rateResolverService");

// POST /api/rates/resolve-bulk (Calculators & BOQs Phase-1 Rate Resolver)
router.post("/resolve-bulk", async (req, res) => {
  try {
    const city = req.body?.city || "Bengaluru";
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const resolvedItems = await resolveBulkRates(items, city);
    res.json({
      success: true,
      city,
      count: resolvedItems.length,
      resolvedItems
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/rates/resolve (Single Item Resolver)
router.post("/resolve", async (req, res) => {
  try {
    const city = req.body?.city || "Bengaluru";
    const item = req.body?.item || req.body || {};
    const resolved = await resolveSingleRate(item, city);
    res.json({
      success: true,
      city,
      resolvedItem: resolved
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

