const mongoose = require("mongoose");
require("dotenv").config();

async function inspectDb() {
  await mongoose.connect(process.env.MONGODB_URI);
  const MasterItem = require("./models/MasterItem");
  const MarketRate = require("./models/MarketRate");

  const legacyNoMat = await MasterItem.find({ masterItemCode: { $not: /^MAT-\d{6}$/ } }).limit(10);
  console.log("Sample legacy items not matching MAT-XXXXXX:", legacyNoMat.map(i => ({ code: i.masterItemCode, name: i.itemName, category: i.category })));

  const countMatCode = await MasterItem.countDocuments({ masterItemCode: /^MAT-\d{6}$/ });
  console.log("Count of canonical MAT-XXXXXX items:", countMatCode);

  const countLegacyCode = await MasterItem.countDocuments({ masterItemCode: { $not: /^MAT-\d{6}$/ } });
  console.log("Count of non-MAT-XXXXXX items:", countLegacyCode);

  await mongoose.disconnect();
}

inspectDb();
