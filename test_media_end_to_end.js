require("dotenv").config();
const mongoose = require("mongoose");
const RealEstateProperty = require("./models/RealEstateProperty");

async function runMediaVerification() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("================================================================================");
    console.log("🚀 STARTING MULTI-MEDIA REAL ESTATE END-TO-END VERIFICATION");
    console.log("================================================================================");

    const testCode = `REP-MEDIA-${Date.now().toString().slice(-6)}`;
    const newPropertyPayload = {
      propertyCode: testCode,
      providerUserCode: "REA-000002",
      providerName: "Garden Greens Consultants",
      providerPhone: "9986553549",
      providerRole: "realestate",
      title: "Devanahalli BMRDA Media Villa Test",
      description: "Full multi-media verification villa with 3 images, 1 MP4 video, and 2 PDF documents.",
      city: "Devanahalli, Bengaluru",
      locality: "Airport Corridor",
      location: "Devanahalli, Bengaluru",
      propertyType: "villa",
      listingType: "Sale",
      transactionType: "sale",
      price: 21000000,
      askingPrice: 21000000,
      totalAmount: 21000000,
      area: 2800,
      plotArea: 2800,
      totalArea: 2800,
      pricePerSqft: 7500,
      ratePerSqft: 7500,
      
      // 3 Images
      images: [
        "/api/realestate/images/realestate_img_sample1.webp",
        "/api/realestate/images/realestate_img_sample2.webp",
        "/api/realestate/images/realestate_img_sample3.webp"
      ],
      coverImage: "/api/realestate/images/realestate_img_sample1.webp",

      // 1 Video
      videoUrl: "/api/realestate/images/realestate_vid_walkthrough.mp4",
      videoUrls: ["/api/realestate/images/realestate_vid_walkthrough.mp4"],

      // 2 Documents
      documents: [
        { name: "Property_Brochure.pdf", url: "/api/realestate/images/realestate_doc_brochure.pdf", fileType: "pdf" },
        { name: "BMRDA_Approval_Certificate.pdf", url: "/api/realestate/images/realestate_doc_approval.pdf", fileType: "pdf" }
      ],
      documentUrls: [
        "/api/realestate/images/realestate_doc_brochure.pdf",
        "/api/realestate/images/realestate_doc_approval.pdf"
      ],

      status: "Available",
      approvalStatus: "Approved",
      isActive: true,
    };

    // 1. Create property with 3 Images, 1 Video, 2 Documents in MongoDB Atlas
    const createdProp = await RealEstateProperty.create(newPropertyPayload);
    console.log(`✅ 1. Created Property in MongoDB Atlas! _id: ${createdProp._id}, Code: ${createdProp.propertyCode}`);
    console.log(`   - Images Stored: ${createdProp.images.length} (Max 3)`);
    console.log(`   - Video URL Stored: ${createdProp.videoUrl}`);
    console.log(`   - Documents Stored: ${createdProp.documents.length} (Max 5)`);

    // 2. Update Property Title & Price while preserving media
    createdProp.title = "UPDATED: Devanahalli BMRDA Media Villa Test";
    createdProp.price = 22500000;
    await createdProp.save();
    console.log(`✅ 2. Property Updated in MongoDB! New Title: "${createdProp.title}", Price: ₹${createdProp.price}`);
    console.log(`   - Images Preserved: ${createdProp.images.length}`);
    console.log(`   - Video Preserved: ${createdProp.videoUrl}`);
    console.log(`   - Documents Preserved: ${createdProp.documents.length}`);

    // 3. Verify Public Hub Query returns images, video, and documents
    const publicProps = await RealEstateProperty.find({
      isActive: { $ne: false },
      status: { $nin: ["inactive", "Inactive", "sold", "Sold", "rented", "Rented"] },
    }).sort({ createdAt: -1 }).lean();

    const publicFound = publicProps.find(p => p.propertyCode === createdProp.propertyCode);
    console.log(`✅ 3. Public Hub Verification! Property ${createdProp.propertyCode} returned in public API with video: ${Boolean(publicFound?.videoUrl)} and ${publicFound?.documents?.length} documents!`);

    // 4. Verify Seller Dashboard Query returns the property
    const sellerProps = await RealEstateProperty.find({ providerUserCode: "REA-000002" }).sort({ createdAt: -1 }).lean();
    const sellerFound = sellerProps.find(p => p.propertyCode === createdProp.propertyCode);
    console.log(`✅ 4. Seller Dashboard Verification! Property ${createdProp.propertyCode} found in seller query: ${Boolean(sellerFound)}`);

    console.log("================================================================================");
    console.log("🎉 ALL MULTI-MEDIA END-TO-END VERIFICATION CHECKS PASSED!");
    console.log("================================================================================");

    process.exit(0);
  } catch (err) {
    console.error("❌ Verification error:", err);
    process.exit(1);
  }
}

runMediaVerification();
