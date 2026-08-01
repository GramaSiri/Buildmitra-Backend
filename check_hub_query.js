require("dotenv").config();
const mongoose = require("mongoose");
const RealEstateProperty = require("./models/RealEstateProperty");

async function checkHubQuery() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Total properties in DB
    const allCount = await RealEstateProperty.countDocuments({});
    console.log("Total properties in MongoDB Atlas:", allCount);

    const allProps = await RealEstateProperty.find({}).sort({ createdAt: -1 }).lean();
    console.log("\nProperties List in MongoDB Atlas:");
    allProps.forEach((p, idx) => {
      console.log(`[${idx + 1}] Code: ${p.propertyCode}, Title: "${p.title}", Status: "${p.status}", Approval: "${p.approvalStatus}", Active: ${p.isActive}, Type: "${p.propertyType}", Listing: "${p.listingType}"`);
    });

    // Public Hub query test
    const publicProps = await RealEstateProperty.find({
      isActive: { $ne: false },
      status: { $nin: ["inactive", "Inactive", "sold", "Sold", "rented", "Rented"] },
      isBlocked: { $ne: true },
    }).sort({ createdAt: -1 }).lean();

    console.log("\nPublic Query returned count:", publicProps.length);

    process.exit(0);
  } catch (err) {
    console.error("Error checking hub query:", err);
    process.exit(1);
  }
}

checkHubQuery();
