const mongoose = require("mongoose");
require("dotenv").config({ path: "D:\\images\\Desktop\\BMBackend\\.env" });

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/buildmitra";

async function runAudit() {
  try {
    console.log("Connecting to MongoDB:", mongoUri.replace(/\/\/.*@/, "//<credentials>@"));
    await mongoose.connect(mongoUri);

    const MasterItem = require("./models/MasterItem");
    const MarketRate = require("./models/MarketRate");
    const MasterMaterial = require("./models/MasterMaterial");

    const masterItemCount = await MasterItem.countDocuments();
    const marketRateCount = await MarketRate.countDocuments();
    let masterMaterialCount = 0;
    try {
      masterMaterialCount = await MasterMaterial.countDocuments();
    } catch {}

    console.log(`CURRENT MONGO COUNTS:`);
    console.log(`  MasterItem: ${masterItemCount}`);
    console.log(`  MarketRate: ${marketRateCount}`);
    console.log(`  MasterMaterial: ${masterMaterialCount}`);

    // Check by itemType
    const types = await MasterItem.aggregate([
      { $group: { _id: "$itemType", count: { $sum: 1 } } }
    ]);
    console.log("MasterItem counts by itemType:", types);

    // Check target codes: WPM-02881, WPM-02980, WPL-02881, WPL-02905
    const targetCodes = ["WPM-02881", "WPM-02980", "WPL-02881", "WPL-02905"];
    const foundMasterItems = await MasterItem.find({ masterItemCode: { $in: targetCodes } });
    const foundMarketRates = await MarketRate.find({
      $or: [{ masterItemCode: { $in: targetCodes } }, { itemCode: { $in: targetCodes } }]
    });

    console.log(`TARGET CODES AUDIT:`);
    console.log(`  Found in MasterItem (${foundMasterItems.length}/4):`, foundMasterItems.map(i => `${i.masterItemCode} (${i.itemName})`));
    console.log(`  Found in MarketRate (${foundMarketRates.length}/4):`, foundMarketRates.map(r => `${r.itemCode || r.masterItemCode} (₹${r.currentRate})`));

    await mongoose.disconnect();
  } catch (err) {
    console.error("Mongo Audit Error:", err);
  }
}

runAudit();
