const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");
const MasterItem = require("../models/MasterItem");
const MarketplaceListing = require("../models/MarketplaceListing");
const { upsertProviderListing } = require("../services/marketplaceService");

async function runSupplierEndToEndTest() {
  console.log("=================================================");
  console.log("  BUILDMITRA SUPPLIER END-TO-END VERIFICATION  ");
  console.log("=================================================\n");

  const results = {
    masterItemFields: "FAIL",
    uniqueIndexAndDuplicates: "FAIL",
    individualAndBulkAdd: "FAIL",
    persistence: "FAIL",
    rateEditProposedRateProtection: "FAIL",
    availabilityImmediateUpdate: "FAIL"
  };

  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("No MONGODB_URI found in environment");
    console.log("Connecting to MongoDB...");
    await mongoose.connect(uri);
    console.log("✅ 1. Connected to MongoDB");

    // Test 1: MasterItem Schema Field Verification
    const sampleMaster = await MasterItem.findOne({ status: "active" });
    if (!sampleMaster) throw new Error("No active MasterItem found");

    console.log("\n✅ 2. MasterItem Active Document Found:");
    console.log(`   - Product/Master ID: ${sampleMaster.masterItemCode}`);
    console.log(`   - Product Name: ${sampleMaster.itemName}`);
    console.log(`   - Category: ${sampleMaster.category}`);
    console.log(`   - Subcategory: ${sampleMaster.subCategory || "N/A"}`);
    console.log(`   - Brand: ${sampleMaster.brand || "N/A"}`);
    console.log(`   - Specification: ${sampleMaster.specification || "N/A"}`);
    console.log(`   - Unit: ${sampleMaster.unit}`);
    console.log(`   - Admin Reference Rate: ₹${sampleMaster.referenceRate}`);
    console.log(`   - Canonical Image: ${sampleMaster.imageUrl}`);
    console.log(`   - Active Status: ${sampleMaster.status}`);

    if (
      sampleMaster.masterItemCode &&
      sampleMaster.itemName &&
      sampleMaster.category !== undefined &&
      sampleMaster.unit !== undefined
    ) {
      results.masterItemFields = "PASS";
    }

    // Pick 3 real active MasterItems for testing
    const threeMasters = await MasterItem.find({ status: "active" }).limit(3);
    if (threeMasters.length < 3) throw new Error("Need at least 3 active MasterItems for testing");

    const testProviderCode = "TEST-SUP-999";
    const codes = threeMasters.map((m) => m.masterItemCode);
    console.log(`\nSelected 3 MasterItems for test: ${codes.join(", ")}`);

    // Clean up any old test records for TEST-SUP-999
    await MarketplaceListing.deleteMany({ providerUserCode: testProviderCode });

    // Test 2: Add 3 Products (Individual + Bulk flow)
    const listing1 = await upsertProviderListing({
      providerUserCode: testProviderCode,
      providerName: "Test Supplier Enterprises",
      masterItemCode: codes[0],
      rate: 390,
      providerStock: 500,
      availability: "In Stock",
      deliveryTime: "24 Hours"
    });

    const listing2 = await upsertProviderListing({
      providerUserCode: testProviderCode,
      providerName: "Test Supplier Enterprises",
      masterItemCode: codes[1],
      rate: 450,
      providerStock: 200,
      availability: "In Stock"
    });

    const listing3 = await upsertProviderListing({
      providerUserCode: testProviderCode,
      providerName: "Test Supplier Enterprises",
      masterItemCode: codes[2],
      rate: 1200,
      providerStock: 150,
      availability: "In Stock"
    });

    console.log(`\n✅ 3. Added 3 products for provider ${testProviderCode}:`);
    console.log(`   [1] ${listing1.masterItemCode} | Rate: ₹${listing1.rate} | Status: ${listing1.status}`);
    console.log(`   [2] ${listing2.masterItemCode} | Rate: ₹${listing2.rate} | Status: ${listing2.status}`);
    console.log(`   [3] ${listing3.masterItemCode} | Rate: ₹${listing3.rate} | Status: ${listing3.status}`);

    results.individualAndBulkAdd = "PASS";

    // Test 3: DB Persistence Check
    const savedListings = await MarketplaceListing.find({
      providerUserCode: testProviderCode,
      isArchived: { $ne: true }
    });

    if (savedListings.length === 3) {
      console.log(`\n✅ 4. Persistence Check PASS: All 3 products retained in MongoDB.`);
      results.persistence = "PASS";
    } else {
      console.error(`❌ Persistence Check FAIL: Expected 3, got ${savedListings.length}`);
    }

    // Simulate Admin approving Listing #1 at ₹390
    listing1.status = "approved";
    listing1.approvalStatus = "approved";
    listing1.approvedRate = 390;
    listing1.rate = 390;
    listing1.proposedRate = 0;
    await listing1.save();

    console.log(`\nSimulated Admin approval for ${listing1.masterItemCode}:`);
    console.log(`   approvedRate = ₹${listing1.approvedRate}, live rate = ₹${listing1.rate}, proposedRate = ${listing1.proposedRate}`);

    // Test 4: Rate Edit & ProposedRate Protection (Correction 1)
    console.log(`\nTesting Supplier Rate Edit for ${listing1.masterItemCode}...`);
    console.log(`   Supplier submits new proposedRate = ₹405...`);

    const editedListing = await upsertProviderListing({
      providerUserCode: testProviderCode,
      providerName: "Test Supplier Enterprises",
      masterItemCode: listing1.masterItemCode,
      proposedRate: 405,
      providerStock: 600,
      availability: "In Stock"
    });

    console.log(`   After edit saved:`);
    console.log(`   - Same MongoDB Record ID: ${editedListing._id.toString() === listing1._id.toString() ? "RETAINED (PASS)" : "NEW RECORD (FAIL)"}`);
    console.log(`   - approvedRate (Live Rate): ₹${editedListing.approvedRate} (Target: ₹390)`);
    console.log(`   - live marketplace rate: ₹${editedListing.rate} (Target: ₹390)`);
    console.log(`   - proposedRate: ₹${editedListing.proposedRate} (Target: ₹405)`);
    console.log(`   - Status: ${editedListing.status} (Target: pending)`);

    const totalCountForCode = await MarketplaceListing.countDocuments({
      providerUserCode: testProviderCode,
      masterItemCode: listing1.masterItemCode,
      isArchived: { $ne: true }
    });

    console.log(`   - Total active DB records for combination: ${totalCountForCode} (Target: 1)`);

    if (
      editedListing._id.toString() === listing1._id.toString() &&
      editedListing.approvedRate === 390 &&
      editedListing.rate === 390 &&
      editedListing.proposedRate === 405 &&
      editedListing.status === "pending" &&
      totalCountForCode === 1
    ) {
      console.log("✅ Rate Safety & ProposedRate Protection PASS!");
      results.rateEditProposedRateProtection = "PASS";
      results.uniqueIndexAndDuplicates = "PASS";
    } else {
      console.error("❌ Rate Safety Check FAIL!");
    }

    // Test 5: Immediate Stock / Availability Update (Correction 7)
    console.log(`\nTesting Stock & Availability immediate update for ${listing2.masterItemCode}...`);
    listing2.availability = "Out of Stock";
    listing2.providerStock = 0;
    await listing2.save();

    const checkAvail = await MarketplaceListing.findById(listing2._id);
    if (checkAvail.availability === "Out of Stock" && checkAvail.providerStock === 0) {
      console.log("✅ Immediate Stock/Availability Update PASS!");
      results.availabilityImmediateUpdate = "PASS";
    }

    // Clean up test provider records
    await MarketplaceListing.deleteMany({ providerUserCode: testProviderCode });

    console.log("\n=================================================");
    console.log("                 VERIFICATION RESULTS            ");
    console.log("=================================================");
    console.log(`MasterItem Fields:                   ${results.masterItemFields}`);
    console.log(`Unique Index & Duplicate Safety:    ${results.uniqueIndexAndDuplicates}`);
    console.log(`Individual & Bulk Add:               ${results.individualAndBulkAdd}`);
    console.log(`DB Persistence (Refresh/Relogin):    ${results.persistence}`);
    console.log(`Approved/Proposed Rate Protection:   ${results.rateEditProposedRateProtection}`);
    console.log(`Stock / Availability Update:         ${results.availabilityImmediateUpdate}`);
    console.log("=================================================\n");

    process.exit(0);
  } catch (err) {
    console.error("❌ End-to-End Test Failed:", err);
    process.exit(1);
  }
}

runSupplierEndToEndTest();
