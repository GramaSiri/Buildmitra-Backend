const mongoose = require("mongoose");
require("dotenv").config({ path: "D:\\images\\Desktop\\BMBackend\\.env" });

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/buildmitra";

const targetItems = [
  {
    masterItemCode: "WPM-02881",
    itemType: "material",
    category: "Waterproofing",
    subCategory: "Cementitious Coating",
    itemName: "Two Component Cementitious Waterproofing Material",
    brand: "BuildMitra Approved",
    specification: "2-Component Polymer Modified Cementitious Coating (IS 15898)",
    unit: "KG",
    referenceRate: 85,
    gst: 18,
    hsnCode: "3824",
    status: "active"
  },
  {
    masterItemCode: "WPM-02980",
    itemType: "material",
    category: "Waterproofing",
    subCategory: "Primer",
    itemName: "Waterproofing Primer Liquid",
    brand: "BuildMitra Approved",
    specification: "High Penetration Acrylic/Bituminous Waterproofing Primer",
    unit: "L",
    referenceRate: 180,
    gst: 18,
    hsnCode: "3208",
    status: "active"
  },
  {
    masterItemCode: "WPL-02881",
    itemType: "labour",
    category: "Waterproofing",
    subCategory: "Application Labour",
    itemName: "Two Component Cementitious Waterproofing Application Labour",
    brand: "BuildMitra Service",
    specification: "2 Coats Application Labour with Surface Preparation & Cleaning",
    unit: "M²",
    referenceRate: 65,
    gst: 18,
    hsnCode: "9954",
    status: "active"
  },
  {
    masterItemCode: "WPL-02905",
    itemType: "labour",
    category: "Waterproofing",
    subCategory: "Application Labour",
    itemName: "Waterproofing Membrane / Coating Application Labour",
    brand: "BuildMitra Service",
    specification: "Membrane Torch-on / PU Coating Application Labour",
    unit: "M²",
    referenceRate: 75,
    gst: 18,
    hsnCode: "9954",
    status: "active"
  }
];

async function seedTargetItems() {
  try {
    console.log("Connecting to MongoDB for seeding...");
    await mongoose.connect(mongoUri);

    const { createOrUpdateMasterItem } = require("./services/marketplaceService");
    const MasterItem = require("./models/MasterItem");
    const MarketRate = require("./models/MarketRate");

    for (const item of targetItems) {
      const res = await createOrUpdateMasterItem(item, "admin");
      console.log(`Seeded ${item.masterItemCode} (${item.itemName}):`, res.isNew ? "CREATED NEW" : "UPDATED EXISTING");
    }

    const masterItemCount = await MasterItem.countDocuments();
    const marketRateCount = await MarketRate.countDocuments();

    console.log(`UPDATED MONGO COUNTS:`);
    console.log(`  MasterItem total: ${masterItemCount}`);
    console.log(`  MarketRate total: ${marketRateCount}`);

    const foundMasterItems = await MasterItem.find({ masterItemCode: { $in: targetItems.map(t => t.masterItemCode) } });
    const foundMarketRates = await MarketRate.find({ masterItemCode: { $in: targetItems.map(t => t.masterItemCode) } });

    console.log(`VERIFICATION RESULT:`);
    console.log(`  MasterItem target count (${foundMasterItems.length}/4):`, foundMasterItems.map(i => `${i.masterItemCode} (${i.itemType}: ${i.itemName})`));
    console.log(`  MarketRate target count (${foundMarketRates.length}/4):`, foundMarketRates.map(r => `${r.masterItemCode} (₹${r.currentRate})`));

    await mongoose.disconnect();
  } catch (err) {
    console.error("Seed error:", err);
  }
}

seedTargetItems();
