const mongoose = require("mongoose");
require("dotenv").config({ path: "d:/images/Desktop/BMBackend/.env" });
const MasterItem = require("../models/MasterItem");

async function checkDist() {
  await mongoose.connect(process.env.MONGODB_URI);
  const total = await MasterItem.countDocuments({});
  const active = await MasterItem.countDocuments({ status: "active" });
  const byType = await MasterItem.aggregate([
    { $group: { _id: "$itemType", count: { $sum: 1 } } }
  ]);
  const categories = await MasterItem.distinct("category");
  console.log({ total, active, byType, categoriesCount: categories.length });
  process.exit(0);
}

checkDist();
