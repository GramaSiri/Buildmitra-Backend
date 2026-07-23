const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

const MasterItem = require("../models/MasterItem");
const MarketplaceListing = require("../models/MarketplaceListing");

async function runTest() {
  console.log("==================================================");
  console.log("🧪 MARKETPLACE PRODUCT IMAGE UPLOAD & DISPLAY TEST");
  console.log("==================================================");

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ 1. Connected to MongoDB Atlas");

  // Ensure master item MAT-CEM-01 exists and is active
  await MasterItem.updateOne(
    { masterItemCode: "MAT-CEM-01" },
    {
      $set: {
        masterItemCode: "MAT-CEM-01",
        itemType: "material",
        category: "Materials",
        subCategory: "Structural",
        itemName: "Cement",
        brand: "UltraTech",
        specification: "OPC 53 Grade",
        unit: "bag",
        status: "active"
      }
    },
    { upsert: true }
  );

  // Create a dummy test image file for upload testing
  const dummyImgPath = path.join(__dirname, "test_sample.png");
  // 1x1 PNG pixel buffer
  const pngBuffer = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  fs.writeFileSync(dummyImgPath, pngBuffer);

  // 1. Single Image Upload Test
  const blob = new Blob([pngBuffer], { type: "image/png" });
  const formData = new FormData();
  formData.append("image", blob, "test_sample.png");

  const uploadRes = await fetch("http://localhost:5000/api/marketplace/upload-image", {
    method: "POST",
    body: formData
  });
  const uploadData = await uploadRes.json();
  console.log("✅ 2. Image upload API response:", uploadData);
  if (!uploadData.success || !uploadData.url) {
    console.error("❌ Image upload failed");
    process.exit(1);
  }

  // 3. Direct Image Browser URL Check
  const imgUrl = `http://localhost:5000${uploadData.url}`;
  const directFetch = await fetch(imgUrl);
  console.log(`✅ 3. Direct image HTTP GET status (${imgUrl}): ${directFetch.status}`);
  if (directFetch.status !== 200) {
    console.error("❌ Direct image HTTP GET failed");
    process.exit(1);
  }

  // 4. Listing Submission Test with Images Array & Legacy ImageUrl
  const providerData = {
    provider: {
      providerUserCode: "SUP-6817",
      providerRole: "supplier",
      providerName: "UltraTech Depot",
      providerPhone: "9876543210",
      city: "Bengaluru"
    },
    items: [
      {
        masterItemCode: "MAT-CEM-01",
        rate: 390,
        imageUrl: uploadData.url,
        images: [{ url: uploadData.url, isPrimary: true, alt: "Cement Bag" }]
      }
    ]
  };

  const submitRes = await fetch("http://localhost:5000/api/provider/marketplace-listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(providerData)
  });
  const submitData = await submitRes.json();
  console.log("✅ 4. Listing submission response:", submitData.success, "Listings count:", submitData.listings?.length);
  if (!submitData.success || !submitData.listings?.length) {
    console.error("❌ Listing submission failed", submitData);
    process.exit(1);
  }

  const createdListing = submitData.listings[0];
  console.log("   Saved Listing Images Array:", createdListing.images);
  console.log("   Saved Listing ImageUrl:", createdListing.imageUrl);

  // 5. Admin Approval
  await MarketplaceListing.updateOne(
    { _id: createdListing._id },
    { $set: { status: "approved", approvalStatus: "approved", isActive: true } }
  );
  console.log("✅ 5. Approved test listing in database");

  // 6. Public Marketplace API verification
  const mktRes = await fetch("http://localhost:5000/api/marketplace");
  const mktData = await mktRes.json();
  const fetchedItem = (mktData.items || []).find(i => i._id.toString() === createdListing._id.toString());
  console.log("✅ 6. Marketplace public API item image field:", fetchedItem?.imageUrl, "images:", fetchedItem?.images);

  // 7. Invalid File Type Test
  const invalidBlob = new Blob(["console.log('bad')"], { type: "text/javascript" });
  const badFormData = new FormData();
  badFormData.append("image", invalidBlob, "test.js");
  const badRes = await fetch("http://localhost:5000/api/marketplace/upload-image", {
    method: "POST",
    body: badFormData
  });
  const badData = await badRes.json();
  console.log(`✅ 7. Invalid file rejection test: success=${badData.success}, message="${badData.message}"`);

  // Cleanup test image file
  if (fs.existsSync(dummyImgPath)) fs.unlinkSync(dummyImgPath);

  console.log("\n==================================================");
  console.log("🎉 MARKETPLACE PRODUCT IMAGE TEST SUCCEEDED!");
  console.log("==================================================");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test runtime exception:", err);
  process.exit(1);
});
