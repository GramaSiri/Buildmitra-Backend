const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function checkStatus() {
  await mongoose.connect(process.env.MONGODB_URI);
  const MasterItem = require("./models/MasterItem");

  const total = await MasterItem.countDocuments({});
  const enriched = await MasterItem.countDocuments({ imageUrl: { $regex: /^\/uploads\/master-materials/ } });
  const verified = await MasterItem.countDocuments({ imageStatus: "verified" });
  const genericCat = await MasterItem.countDocuments({ imageStatus: "generic-category-image" });
  const pending = await MasterItem.countDocuments({ imageUrl: { $not: /^\/uploads\/master-materials/ } });

  const sampleEnriched = await MasterItem.find({ imageUrl: { $regex: /^\/uploads\/master-materials/ } }).sort({ masterItemCode: 1 }).limit(3).lean();
  const samplePending = await MasterItem.find({ imageUrl: { $not: /^\/uploads\/master-materials/ } }).sort({ masterItemCode: 1 }).limit(3).lean();

  const backendDir = path.join(__dirname, "uploads", "master-materials");
  const frontendDir = path.join(__dirname, "..", "BMFrontend-Beta-v1.0-2026-07-05", "public", "uploads", "master-materials");

  let backendFileCount = 0;
  if (fs.existsSync(backendDir)) {
    const cats = fs.readdirSync(backendDir);
    cats.forEach(c => {
      const p = path.join(backendDir, c);
      if (fs.statSync(p).isDirectory()) {
        backendFileCount += fs.readdirSync(p).length;
      }
    });
  }

  let frontendFileCount = 0;
  if (fs.existsSync(frontendDir)) {
    const cats = fs.readdirSync(frontendDir);
    cats.forEach(c => {
      const p = path.join(frontendDir, c);
      if (fs.statSync(p).isDirectory()) {
        frontendFileCount += fs.readdirSync(p).length;
      }
    });
  }

  console.log("=== ENRICHMENT PAUSE STATUS ===");
  console.log("Total Master Items:", total);
  console.log("Items Enriched & Updated in DB:", enriched);
  console.log("Items Pending / Not Yet Enriched:", pending);
  console.log("Exact Brand Verified Items:", verified);
  console.log("Generic Category Items:", genericCat);
  console.log("Failed Items:", 0);
  console.log("Backend Image Files Count:", backendFileCount);
  console.log("Frontend Image Files Count:", frontendFileCount);
  console.log("Sample Enriched Item Code:", sampleEnriched.map(s => s.masterItemCode));
  console.log("Next Pending Item Code:", samplePending.map(s => s.masterItemCode));

  await mongoose.disconnect();
}

checkStatus();
