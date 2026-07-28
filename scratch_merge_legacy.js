const mongoose = require("mongoose");
const XLSX = require("xlsx");
require("dotenv").config();

const MONGODB_URI = process.env.MONGODB_URI;
const csvPath = 'D:\\images\\Desktop\\MM_26_7.csv';

function normalizeUnit(unitStr) {
  if (!unitStr) return "NOS";
  const u = String(unitStr).trim().toUpperCase();
  if (["KG", "KGS", "KILOGRAM", "KILOGRAMS"].includes(u)) return "KG";
  if (["BAG", "BAGS", "50KG"].includes(u)) return "BAG";
  if (["NOS", "NO", "PIECE", "PIECES", "UNIT", "ACCESSORY", "SANITARYWARE", "FITTING"].includes(u)) return "NOS";
  if (["CFT", "CU.FT", "CUBIC FEET"].includes(u)) return "CFT";
  if (["SQFT", "SQ. FT.", "SQ.FT", "SFT", "SQUARE FEET"].includes(u)) return "SQFT";
  if (["CUM", "M3", "CUBIC METRE", "CUBIC METER"].includes(u)) return "CUM";
  if (["LTR", "LITRE", "LITER", "LITRES"].includes(u)) return "LTR";
  if (["M", "METER", "METRE", "MTR"].includes(u)) return "M";
  if (["MT", "TON", "TONNE", "METRIC TON"].includes(u)) return "MT";
  if (["DAY", "DAYS"].includes(u)) return "DAY";
  if (["HR", "HOUR", "HOURS"].includes(u)) return "HR";
  if (["BOX", "BOXES"].includes(u)) return "BOX";
  if (["ROLL", "ROLLS"].includes(u)) return "ROLL";
  if (["PACK", "PACKS"].includes(u)) return "PACK";
  if (["SET", "SETS"].includes(u)) return "SET";
  if (["PAIR", "PAIRS"].includes(u)) return "PAIR";
  return u;
}

function parseGst(gstVal) {
  if (gstVal === undefined || gstVal === null || gstVal === "") return 0;
  const num = Number(gstVal);
  if (isNaN(num)) return 0;
  if (num > 0 && num < 1) return Math.round(num * 100);
  return num;
}

async function mergeLegacy() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const MasterItem = require("./models/MasterItem");
  const MarketRate = require("./models/MarketRate");

  const workbook = XLSX.readFile(csvPath);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

  console.log(`Processing ${rows.length} rows for canonical deduplication...`);

  // Remove existing masteritems and re-insert cleanly with legacyCode field
  await MasterItem.deleteMany({});
  await MarketRate.deleteMany({});

  const masterDocs = [];
  const rateDocs = [];

  const todayStr = new Date().toISOString().split("T")[0];

  rows.forEach((row) => {
    const masterItemCode = String(row["Master Code"] || "").trim().toUpperCase();
    const legacyCode = String(row["Legacy Code"] || "").trim().toUpperCase();
    const itemName = String(row["Item Name"] || "").trim();
    const category = String(row["Category"] || "").trim();
    const subCategory = String(row["Sub Category"] || "").trim();
    const brand = String(row["Brand/Short Code"] || "").trim();
    const specification = String(row["Specification"] || "").trim();
    const unit = normalizeUnit(row["Unit"]);
    const referenceRate = Number(row["Base Rate/Price"] || 0);
    const gst = parseGst(row["GST/TAX"]);
    const hsnCode = String(row["HSN Code"] || "").trim();

    const isLabour = category.toLowerCase().includes("labour") || itemName.toLowerCase().includes("labour");
    const itemType = isLabour ? "labour" : "material";

    masterDocs.push({
      masterItemCode,
      legacyCode,
      itemType,
      category,
      subCategory,
      itemName,
      brand,
      specification,
      unit,
      gst,
      hsnCode,
      referenceRate,
      status: "active",
      createdBy: "MM_26_7_import",
      updatedBy: "MM_26_7_import"
    });

    rateDocs.push({
      masterItemCode,
      itemCode: masterItemCode,
      legacyCode,
      itemName,
      itemType,
      category,
      subCategory,
      specification,
      brand,
      currentRate: referenceRate,
      unit,
      gst,
      city: "Bengaluru",
      state: "Karnataka",
      region: "Bengaluru",
      sourceType: "admin_manual",
      sourceName: "BuildMitra Approved (MM_26_7)",
      approvalStatus: "approved",
      isActive: true,
      approvedBy: "Admin",
      effectiveDate: todayStr
    });
  });

  await MasterItem.insertMany(masterDocs);
  await MarketRate.insertMany(rateDocs);

  const finalMasterCount = await MasterItem.countDocuments({});
  const finalRateCount = await MarketRate.countDocuments({});

  console.log("=== RE-IMPORT AND DEDUPLICATION COMPLETED ===");
  console.log("Final Canonical MasterItem Count:", finalMasterCount);
  console.log("Final Canonical MarketRate Count:", finalRateCount);

  await mongoose.disconnect();
}

mergeLegacy();
