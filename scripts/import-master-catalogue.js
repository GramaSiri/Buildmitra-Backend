const mongoose = require("mongoose");
const XLSX = require("xlsx");
const path = require("path");
const MasterItem = require("../models/MasterItem");

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/buildmitra";
const FILE = path.join(__dirname, "..", "BuildMitra_Master_Catalogue.xlsx");

function clean(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function importSheet(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.log("Sheet missing:", sheetName);
    return { sheetName, count: 0 };
  }

  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  let count = 0;

  for (const r of rows) {
    const masterItemCode = clean(r["Master Code"]).toUpperCase();
    if (!masterItemCode) continue;

    const doc = {
      masterItemCode,
      itemType: clean(r["Item Type"]).toLowerCase(),
      category: clean(r["Category"]),
      subCategory: clean(r["Sub Category"]),
      brand: clean(r["Brand/Short Code"]),
      itemName: clean(r["Item Name"]),
      specification: clean(r["Specification"]),
      unit: clean(r["Unit"]),
      gst: num(r["GST/TAX"]),
      hsnCode: clean(r["HSN Code"]),
      imageUrl: clean(r["Image Path"]) || `/master-images/${masterItemCode}.webp`,
      referenceRate: num(r["Base Rate/Price"]),
      status: clean(r["Status"]).toLowerCase() === "inactive" ? "inactive" : "active",
      createdBy: "excel-import",
      updatedBy: "excel-import",
    };

    if (!doc.itemName || !doc.itemType) continue;

    await MasterItem.updateOne(
      { masterItemCode },
      { $set: doc },
      { upsert: true }
    );

    count++;
  }

  console.log(sheetName, "imported/updated:", count);
  return { sheetName, count };
}

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected");

    const wb = XLSX.readFile(FILE);

    await importSheet(wb, "Materials_Master");
    await importSheet(wb, "Labour_Master");
    await importSheet(wb, "Machinery_Master");
    await importSheet(wb, "Services_Master");

    const total = await MasterItem.countDocuments();
    console.log("Total Master Items in DB:", total);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("IMPORT FAILED:", err);
    process.exit(1);
  }
})();
