const mongoose = require("mongoose");
require("dotenv").config({ path: "d:/images/Desktop/BMBackend/.env" });
const MarketplaceListing = require("../models/MarketplaceListing");

async function auditAndCleanupDuplicates() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error("No MONGODB_URI found");
      process.exit(1);
    }
    await mongoose.connect(uri);
    console.log("Connected to MongoDB for audit...");

    // Set default isArchived: false for documents where it's missing
    await MarketplaceListing.updateMany(
      { isArchived: { $exists: false } },
      { $set: { isArchived: false } }
    );

    // Find duplicates grouped by providerUserCode + masterItemCode where isArchived is false
    const duplicates = await MarketplaceListing.aggregate([
      {
        $match: {
          providerUserCode: { $exists: true, $ne: "" },
          masterItemCode: { $exists: true, $ne: "" },
          isArchived: false
        }
      },
      {
        $group: {
          _id: {
            providerUserCode: "$providerUserCode",
            masterItemCode: "$masterItemCode"
          },
          count: { $sum: 1 },
          docs: { $push: { id: "$_id", status: "$status", rate: "$rate", updatedAt: "$updatedAt" } }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    console.log(`Found ${duplicates.length} duplicate groups.`);

    let archivedCount = 0;
    for (const group of duplicates) {
      console.log(`Processing duplicate group for providerUserCode: ${group._id.providerUserCode}, masterItemCode: ${group._id.masterItemCode} (${group.count} records)`);
      const sorted = group.docs.sort((a, b) => {
        if (a.status === "approved" && b.status !== "approved") return -1;
        if (b.status === "approved" && a.status !== "approved") return 1;
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      });

      const keepId = sorted[0].id;
      const archiveIds = sorted.slice(1).map(d => d.id);

      console.log(`Keeping record ID: ${keepId}, archiving: ${archiveIds.join(", ")}`);

      await MarketplaceListing.updateMany(
        { _id: { $in: archiveIds } },
        { $set: { isArchived: true } }
      );
      archivedCount += archiveIds.length;
    }

    console.log(`Archived ${archivedCount} duplicate records.`);

    try {
      await MarketplaceListing.collection.dropIndex("providerUserCode_1_masterItemCode_1");
    } catch (e) {
      // index might not exist
    }

    console.log("Creating unique index on { providerUserCode: 1, masterItemCode: 1 }...");
    await MarketplaceListing.collection.createIndex(
      { providerUserCode: 1, masterItemCode: 1 },
      { unique: true, partialFilterExpression: { isArchived: false } }
    );

    console.log("✅ Audit and index creation complete!");
    process.exit(0);
  } catch (err) {
    console.error("Error during audit:", err);
    process.exit(1);
  }
}

auditAndCleanupDuplicates();
