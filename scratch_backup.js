const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI missing!");
  process.exit(1);
}

async function runBackup() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected successfully to MongoDB database:", mongoose.connection.name);

    const db = mongoose.connection.db;

    const backupDir = path.join(__dirname, "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    const collectionsToBackup = ["masteritems", "marketrates", "mastermaterials", "marketplacelistings", "ratehistories"];

    const summary = {};

    for (const collName of collectionsToBackup) {
      const coll = db.collection(collName);
      const docs = await coll.find({}).toArray();
      const backupFile = path.join(backupDir, `backup_${collName}_${timestamp}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(docs, null, 2));
      summary[collName] = {
        count: docs.length,
        file: backupFile
      };
      console.log(`Backed up collection '${collName}': ${docs.length} records saved to ${backupFile}`);
    }

    console.log("\n=== BACKUP COMPLETED SUCCESSFULLY ===");
    console.log(JSON.stringify(summary, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error("Backup Error:", err);
    process.exit(1);
  }
}

runBackup();
