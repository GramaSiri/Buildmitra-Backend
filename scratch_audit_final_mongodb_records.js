const mongoose = require("mongoose");
require("dotenv").config({ path: "D:\\images\\Desktop\\BMBackend\\.env" });

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/buildmitra";

async function auditFinalRecords() {
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for Final Audit.");

    const MasterItem = require("./models/MasterItem");
    const MarketRate = require("./models/MarketRate");
    const { resolveSingleRate } = require("./services/rateResolverService");

    const targetCodes = ["MAT-WTR-TNK", "SRV-PCC-01", "PLB-18", "ELEC-15", "FCL-12"];

    console.log("\n=== 1. CANONICAL MONGO RECORDS AUDIT ===");
    for (const code of targetCodes) {
      const primaryItem = await MasterItem.findOne({ masterItemCode: code }).lean();
      const primaryRate = await MarketRate.findOne({ $or: [{ masterItemCode: code }, { itemCode: code }] }).lean();
      
      const linkedCode = primaryItem?.linkedLabourItemCode || `LAB-${code.replace(/^(MAT|SRV|SER|PLB|ELEC|FCL)-?/, "")}`;
      const labourItem = await MasterItem.findOne({ masterItemCode: linkedCode }).lean();
      const labourRate = await MarketRate.findOne({ $or: [{ masterItemCode: linkedCode }, { itemCode: linkedCode }] }).lean();

      console.log(`\nCODE: ${code}`);
      console.log(`  Primary Item: ${primaryItem?.itemName || "N/A"} (${primaryItem?.unit || "N/A"}) -> Material Rate: ₹${primaryRate?.currentRate || primaryItem?.referenceRate || 0}`);
      console.log(`  Linked Labour: ${linkedCode} (${labourItem?.itemName || "N/A"}) -> Labour Rate: ₹${labourRate?.currentRate || labourItem?.referenceRate || 0}`);
      console.log(`  Total Combined Rate: ₹${Number(primaryRate?.currentRate || 0) + Number(labourRate?.currentRate || 0)}`);
    }

    console.log("\n=== 2. API RESOLVER OUTPUT AUDIT ===");
    for (const code of targetCodes) {
      const res = await resolveSingleRate({ masterItemCode: code }, "Bengaluru");
      console.log(`\nRESOLVER [${code}]:`);
      console.log(JSON.stringify(res, null, 2));
    }

    console.log("\n=== 3. GENERATED DUPLICATES CLEANUP AUDIT ===");
    const activeDuplicates = await MasterItem.countDocuments({ masterItemCode: /^(UGSG|WATL)\d+/i, status: "active" });
    const inactiveDuplicates = await MasterItem.countDocuments({ masterItemCode: /^(UGSG|WATL)\d+/i, status: "inactive" });
    console.log(`  Active Generated Codes: ${activeDuplicates}`);
    console.log(`  Deactivated Generated Codes: ${inactiveDuplicates}`);

    await mongoose.disconnect();
  } catch (err) {
    console.error("Audit error:", err);
  }
}

auditFinalRecords();
