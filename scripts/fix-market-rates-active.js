const mongoose = require("mongoose");
require("dotenv").config();
const MarketRate = require("../models/MarketRate");

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);
  await MarketRate.updateMany({}, { $set: { isActive: true, approvalStatus: "approved" } });
  console.log("✅ Updated all MarketRate documents to isActive: true");
  process.exit(0);
}

fix();
