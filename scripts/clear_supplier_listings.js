const mongoose = require("mongoose");
require("dotenv").config({ path: "d:/images/Desktop/BMBackend/.env" });
const MarketplaceListing = require("../models/MarketplaceListing");

async function clearAllSupplierListings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const deleted = await MarketplaceListing.deleteMany({});
    console.log(`✅ Cleared all supplier marketplace listings. Deleted count: ${deleted.deletedCount}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error clearing supplier listings:", err);
    process.exit(1);
  }
}

clearAllSupplierListings();
