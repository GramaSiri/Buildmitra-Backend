require("dotenv").config();
const mongoose = require("mongoose");
const RealEstateProperty = require("./models/RealEstateProperty");

async function checkDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    console.log("Connecting to MongoDB:", mongoUri ? "URI present" : "Missing");
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB Atlas!");

    const properties = await RealEstateProperty.find({}).lean();
    console.log(`Total properties found in MongoDB: ${properties.length}`);

    console.log("--------------------------------------------------------------------------------");
    console.log("| Property Code | Title                        | Status    | Approval  | Images |");
    console.log("--------------------------------------------------------------------------------");

    for (const p of properties) {
      const code = p.propertyCode || "N/A";
      const title = (p.title || "N/A").padEnd(28).slice(0, 28);
      const status = (p.status || "N/A").padEnd(9).slice(0, 9);
      const approval = (p.approvalStatus || "N/A").padEnd(9).slice(0, 9);
      const imgCount = Array.isArray(p.images) ? p.images.length : 0;
      console.log(`| ${code.padEnd(13)} | ${title} | ${status} | ${approval} | ${imgCount} imgs |`);
    }
    console.log("--------------------------------------------------------------------------------");
    process.exit(0);
  } catch (err) {
    console.error("DB Audit error:", err);
    process.exit(1);
  }
}

checkDatabase();
