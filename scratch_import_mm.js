const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
require("dotenv").config();

const MONGODB_URI = process.env.MONGODB_URI;
const csvPath = 'D:\\images\\Desktop\\MM_26_7.csv';

if (!MONGODB_URI) {
  console.error("MONGODB_URI missing!");
  process.exit(1);
}

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

async function runImport() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected successfully to database:", mongoose.connection.name);

    const MasterItem = require("./models/MasterItem");
    const MarketRate = require("./models/MarketRate");

    const workbook = XLSX.readFile(csvPath);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log(`Read ${rows.length} rows from ${csvPath}`);

    const existingMasterCountBefore = await MasterItem.countDocuments({});
    console.log(`Existing MasterItem count before import: ${existingMasterCountBefore}`);

    let insertedCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let duplicateSkippedCount = 0;
    let invalidSkippedCount = 0;
    let manualReviewCount = 0;

    let materialItemCount = 0;
    let labourItemCount = 0;

    const processedCodes = new Set();
    const categoriesSet = new Set();
    const subcategoriesSet = new Set();

    const masterOps = [];
    const rateOps = [];

    const todayStr = new Date().toISOString().split("T")[0];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const code = String(row["Master Code"] || "").trim().toUpperCase();
      const itemName = String(row["Item Name"] || "").trim();
      const category = String(row["Category"] || "").trim();
      const subCategory = String(row["Sub Category"] || "").trim();
      const brand = String(row["Brand/Short Code"] || "").trim();
      const specification = String(row["Specification"] || "").trim();
      const rawUnit = String(row["Unit"] || "").trim();
      const unit = normalizeUnit(rawUnit);
      const rate = Number(row["Base Rate/Price"] || 0);
      const gst = parseGst(row["GST/TAX"]);
      const hsnCode = String(row["HSN Code"] || "").trim();

      if (!code || !itemName) {
        invalidSkippedCount++;
        continue;
      }

      if (processedCodes.has(code)) {
        duplicateSkippedCount++;
        continue;
      }
      processedCodes.add(code);

      const isLabour = category.toLowerCase().includes("labour") || itemName.toLowerCase().includes("labour");
      const itemType = isLabour ? "labour" : "material";

      if (isLabour) labourItemCount++;
      else materialItemCount++;

      if (category) categoriesSet.add(category);
      if (subCategory) subcategoriesSet.add(subCategory);

      // Prepare MasterItem upsert operation
      masterOps.push({
        updateOne: {
          filter: { masterItemCode: code },
          update: {
            $set: {
              masterItemCode: code,
              itemType,
              category,
              subCategory,
              itemName,
              brand,
              specification,
              unit,
              gst,
              hsnCode,
              referenceRate: rate,
              status: "active",
              updatedBy: "MM_26_7_import"
            },
            $setOnInsert: {
              createdBy: "MM_26_7_import"
            }
          },
          upsert: true
        }
      });

      // Prepare Admin MarketRate upsert operation
      rateOps.push({
        updateOne: {
          filter: { itemCode: code, city: "Bengaluru", unit: unit },
          update: {
            $set: {
              masterItemCode: code,
              itemCode: code,
              itemName,
              itemType,
              category,
              subCategory,
              specification,
              brand,
              currentRate: rate,
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
            }
          },
          upsert: true
        }
      });
    }

    console.log(`Executing bulkWrite for ${masterOps.length} MasterItems...`);
    const masterResult = await MasterItem.bulkWrite(masterOps);
    console.log("MasterItems bulkWrite result:", {
      insertedCount: masterResult.upsertedCount,
      modifiedCount: masterResult.modifiedCount,
      matchedCount: masterResult.matchedCount
    });

    console.log(`Executing bulkWrite for ${rateOps.length} MarketRates...`);
    const rateResult = await MarketRate.bulkWrite(rateOps);
    console.log("MarketRates bulkWrite result:", {
      insertedCount: rateResult.upsertedCount,
      modifiedCount: rateResult.modifiedCount,
      matchedCount: rateResult.matchedCount
    });

    const finalMasterItemCount = await MasterItem.countDocuments({});
    const activeMasterItemCount = await MasterItem.countDocuments({ status: "active" });
    const inactiveMasterItemCount = await MasterItem.countDocuments({ status: "inactive" });
    const finalMarketRateCount = await MarketRate.countDocuments({});
    const approvedMarketRateCount = await MarketRate.countDocuments({ approvalStatus: "approved", isActive: true });

    console.log("\n=== IMPORT FINAL SUMMARY ===");
    console.log("Existing Master Items Before Import:", existingMasterCountBefore);
    console.log("New Items Inserted:", masterResult.upsertedCount);
    console.log("Existing Items Updated:", masterResult.modifiedCount);
    console.log("Unchanged Items Matched:", masterResult.matchedCount - masterResult.modifiedCount);
    console.log("Duplicate Rows Skipped:", duplicateSkippedCount);
    console.log("Invalid Rows Skipped:", invalidSkippedCount);
    console.log("Manual Review Rows Flagged:", manualReviewCount);
    console.log("Final Master Item Count:", finalMasterItemCount);
    console.log("Active Master Item Count:", activeMasterItemCount);
    console.log("Inactive Master Item Count:", inactiveMasterItemCount);
    console.log("Material Item Count:", materialItemCount);
    console.log("Labour Item Count:", labourItemCount);
    console.log("Category Count:", categoriesSet.size);
    console.log("Subcategory Count:", subcategoriesSet.size);
    console.log("Initial Market Rates Imported:", rateOps.length);
    console.log("Approved Active Market Rates:", approvedMarketRateCount);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  } catch (err) {
    console.error("Import Error:", err);
    process.exit(1);
  }
}

runImport();
