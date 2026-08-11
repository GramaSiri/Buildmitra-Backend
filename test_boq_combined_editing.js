const mongoose = require("mongoose");
require("dotenv").config({ path: "D:\\images\\Desktop\\BMBackend\\.env" });

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/buildmitra";

async function testBOQCombinedEdit() {
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    const { updateCombinedBOQRate, resolveSingleRate, searchMasterItemsWithBOQLinks } = require("./services/rateResolverService");

    console.log("--- 1. Testing Search Priority for MAT-WTR-TNK ---");
    const searchResults = await searchMasterItemsWithBOQLinks("MAT-WTR-TNK");
    console.log("Search Results for MAT-WTR-TNK:", searchResults.map(i => `${i.masterItemCode} (${i.itemType}: ${i.itemName})`));

    console.log("\n--- 2. Testing Combined Edit for MAT-WTR-TNK (Material: 120000, Labour: 35000) ---");
    const editRes1 = await updateCombinedBOQRate({
      masterItemCode: "MAT-WTR-TNK",
      materialRate: 120000,
      labourRate: 35000,
      unit: "LS",
      city: "Bengaluru",
      remarks: "Updated combined rate via test script"
    });
    console.log("Edit Result 1:", JSON.stringify(editRes1, null, 2));

    console.log("\n--- 3. Testing Resolver Output for MAT-WTR-TNK ---");
    const res1 = await resolveSingleRate({ masterItemCode: "MAT-WTR-TNK" }, "Bengaluru");
    console.log("Resolved MAT-WTR-TNK:", JSON.stringify(res1, null, 2));

    console.log("\n--- 4. Testing Combined Edit for SRV-PCC-01 (Material: 3800, Labour: 800) ---");
    const editRes2 = await updateCombinedBOQRate({
      masterItemCode: "SRV-PCC-01",
      materialRate: 3800,
      labourRate: 800,
      unit: "CUM",
      city: "Bengaluru"
    });
    console.log("Edit Result 2:", JSON.stringify(editRes2, null, 2));

    console.log("\n--- 5. Testing Resolver Output for SRV-PCC-01 ---");
    const res2 = await resolveSingleRate({ masterItemCode: "SRV-PCC-01" }, "Bengaluru");
    console.log("Resolved SRV-PCC-01:", JSON.stringify(res2, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error("Test Error:", err);
  }
}

testBOQCombinedEdit();
