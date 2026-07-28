const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI is required.");
  process.exit(1);
}

async function auditMasterItemImages() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB:", mongoose.connection.name);

    const MasterItem = require("./models/MasterItem");

    const allItems = await MasterItem.find({}).lean();
    console.log(`Total Master Items in DB: ${allItems.length}`);

    let countWithImage = 0;
    let countNoImage = 0;
    const imageUrlMap = new Map(); // url -> count
    const categoryStats = {}; // category -> { total, withImage, missingImage }

    allItems.forEach((item) => {
      const cat = item.category || "Uncategorized";
      if (!categoryStats[cat]) {
        categoryStats[cat] = { total: 0, withImage: 0, missingImage: 0 };
      }
      categoryStats[cat].total++;

      const img = String(item.imageUrl || "").trim();
      if (img && img !== "undefined" && img !== "null") {
        countWithImage++;
        categoryStats[cat].withImage++;
        imageUrlMap.set(img, (imageUrlMap.get(img) || 0) + 1);
      } else {
        countNoImage++;
        categoryStats[cat].missingImage++;
      }
    });

    let duplicateUrlCount = 0;
    const duplicatedUrls = [];
    imageUrlMap.forEach((count, url) => {
      if (count > 1) {
        duplicateUrlCount += count;
        duplicatedUrls.push({ url, count });
      }
    });

    const auditReport = {
      timestamp: new Date().toISOString(),
      totalMasterItems: allItems.length,
      itemsWithImage: countWithImage,
      itemsNoImage: countNoImage,
      duplicateUrlCount,
      uniqueImageUrlsCount: imageUrlMap.size,
      duplicatedUrlsSample: duplicatedUrls.slice(0, 10),
      categoryStats
    };

    console.log("\n================ PHASE 1 AUDIT REPORT ================");
    console.log(`Total Master Items: ${auditReport.totalMasterItems}`);
    console.log(`Items with Image: ${auditReport.itemsWithImage}`);
    console.log(`Items with No Image: ${auditReport.itemsNoImage}`);
    console.log(`Unique Image URLs: ${auditReport.uniqueImageUrlsCount}`);
    console.log(`Duplicate URL Assignments: ${auditReport.duplicateUrlCount}`);
    console.log("\nCategory-wise Missing Image Summary (Top 30):");
    const sortedCategories = Object.entries(categoryStats)
      .sort((a, b) => b[1].missingImage - a[1].missingImage);
    
    sortedCategories.slice(0, 30).forEach(([cat, s]) => {
      console.log(` - ${cat}: ${s.missingImage} missing / ${s.total} total`);
    });

    const auditFile = path.join(__dirname, "backups", `phase1_image_audit_${Date.now()}.json`);
    fs.writeFileSync(auditFile, JSON.stringify(auditReport, null, 2));
    console.log(`\nAudit Report saved to: ${auditFile}`);

    await mongoose.disconnect();
  } catch (err) {
    console.error("Audit error:", err);
    process.exit(1);
  }
}

auditMasterItemImages();
