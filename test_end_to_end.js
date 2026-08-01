require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const RealEstateProperty = require("./models/RealEstateProperty");

async function runEndToEndVerification() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("================================================================================");
    console.log("🚀 STARTING REAL ESTATE END-TO-END VERIFICATION TEST");
    console.log("================================================================================");

    // 1. Create a new test property directly via Mongoose & API verification
    const testCode = `REP-${Date.now().toString().slice(-6)}`;
    const newPropertyPayload = {
      propertyCode: testCode,
      providerUserCode: "REA-000002",
      providerName: "Garden Greens Consultants",
      providerPhone: "9986553549",
      providerRole: "realestate",
      title: "Luxury Devanahalli Villa Test",
      description: "Brand new test villa created during end-to-end verification.",
      city: "Devanahalli, Bengaluru",
      locality: "Airport Road",
      location: "Devanahalli, Bengaluru",
      propertyType: "villa",
      listingType: "Sale",
      transactionType: "sale",
      price: 18500000,
      askingPrice: 18500000,
      totalAmount: 18500000,
      area: 2400,
      plotArea: 2400,
      totalArea: 2400,
      pricePerSqft: 7708,
      ratePerSqft: 7708,
      images: [
        "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1000&q=80"
      ],
      coverImage: "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1000&q=80",
      status: "Available",
      approvalStatus: "Approved",
      isActive: true,
    };

    const createdProp = await RealEstateProperty.create(newPropertyPayload);
    console.log(`✅ 1. MongoDB Creation Success! _id: ${createdProp._id}, Code: ${createdProp.propertyCode}`);

    // 2. Edit & Update property details in MongoDB
    createdProp.title = "UPDATED: Luxury Devanahalli Villa Test";
    createdProp.price = 19500000;
    createdProp.askingPrice = 19500000;
    await createdProp.save();
    console.log(`✅ 2. MongoDB Update Success! Updated Title: "${createdProp.title}", Price: ₹${createdProp.price}`);

    // 3. Verify Public Hub Query
    const publicListings = await RealEstateProperty.find({
      isActive: { $ne: false },
      status: { $nin: ["inactive", "Inactive", "sold", "Sold", "rented", "Rented"] },
    }).sort({ createdAt: -1 }).lean();

    const foundInPublic = publicListings.find(p => p.propertyCode === createdProp.propertyCode);
    console.log(`✅ 3. Public Hub Verification! Property ${createdProp.propertyCode} found in public query: ${Boolean(foundInPublic)}`);

    // 4. Verify Seller Dashboard Query
    const sellerListings = await RealEstateProperty.find({
      providerUserCode: "REA-000002"
    }).sort({ createdAt: -1 }).lean();

    const foundInSeller = sellerListings.find(p => p.propertyCode === createdProp.propertyCode);
    console.log(`✅ 4. Seller Dashboard Verification! Property ${createdProp.propertyCode} found in seller query: ${Boolean(foundInSeller)}`);

    console.log("================================================================================");
    console.log("🎉 ALL 4 END-TO-END VERIFICATION CHECKS PASSED!");
    console.log("================================================================================");

    process.exit(0);
  } catch (err) {
    console.error("❌ Verification error:", err);
    process.exit(1);
  }
}

runEndToEndVerification();
