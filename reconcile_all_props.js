require("dotenv").config();
const mongoose = require("mongoose");
const RealEstateProperty = require("./models/RealEstateProperty");

async function reconcileAllProperties() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("================================================================================");
    console.log("🚀 RECONCILING ALL PROPERTIES FOR PUBLIC REAL ESTATE HUB");
    console.log("================================================================================");

    const result = await RealEstateProperty.updateMany(
      {},
      {
        $set: {
          status: "Available",
          approvalStatus: "Approved",
          isActive: true,
          isBlocked: false,
        },
      }
    );

    console.log(`✅ Reconciled ${result.modifiedCount} property records in MongoDB Atlas!`);

    const publicList = await RealEstateProperty.find({
      isActive: { $ne: false },
      status: { $nin: ["inactive", "Inactive", "sold", "Sold", "rented", "Rented"] },
    }).sort({ createdAt: -1 }).lean();

    console.log("\nPublic Hub query now returns count:", publicList.length);
    publicList.forEach((p, i) => {
      console.log(`[${i + 1}] ${p.propertyCode} - ${p.title} (Status: ${p.status}, Approval: ${p.approvalStatus})`);
    });

    console.log("================================================================================");
    console.log("🎉 ALL PROPERTIES ARE NOW APPROVED AND PUBLICLY VISIBLE!");
    console.log("================================================================================");

    process.exit(0);
  } catch (err) {
    console.error("Reconciliation error:", err);
    process.exit(1);
  }
}

reconcileAllProperties();
