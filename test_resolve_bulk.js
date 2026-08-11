const mongoose = require("mongoose");
require("dotenv").config({ path: "D:\\images\\Desktop\\BMBackend\\.env" });

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/buildmitra";

async function testResolver() {
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    const { resolveBulkRates } = require("./services/rateResolverService");

    const sampleItems = [
      {
        masterItemCode: "JW-001",
        itemName: "Brick Masonry",
        itemType: "labour",
        unit: "SQM"
      },
      {
        masterItemCode: "WPM-02881",
        itemName: "Two Component Cementitious Waterproofing Material",
        itemType: "material",
        unit: "KG"
      },
      {
        masterItemCode: "WPL-02881",
        itemName: "Two Component Cementitious Waterproofing Application Labour",
        itemType: "labour",
        unit: "M²"
      },
      {
        itemName: "Cement OPC 53 Grade",
        itemType: "material",
        unit: "BAG"
      },
      {
        itemName: "Non-Existent Custom Unknown Material Item XYZ",
        itemType: "material",
        unit: "NOS"
      }
    ];

    const results = await resolveBulkRates(sampleItems, "Bengaluru");

    console.log("RESOLVED BULK RATES OUTPUT:");
    console.log(JSON.stringify(results, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error("Error testing resolver:", err);
  }
}

testResolver();
