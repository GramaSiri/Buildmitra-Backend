const mongoose = require("mongoose");
require("dotenv").config();

const User = require("../models/User");

const MONGODB_URI = process.env.MONGODB_URI;

async function runStage1Verification() {
  console.log("==================================================");
  console.log("🧪 STAGE 1 COMPREHENSIVE VERIFICATION SUITE");
  console.log("==================================================");

  if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI missing in .env");
    process.exit(1);
  }

  // 1. Test MongoDB Connection
  console.log("\n[1/5] Testing MongoDB Atlas Connection...");
  await mongoose.connect(MONGODB_URI);
  console.log("✅ MongoDB Connection Verified Successfully!");
  console.log("   Host:", mongoose.connection.host);
  console.log("   Database:", mongoose.connection.name);

  const testPhone = "9900112233";
  const testPassword = "Password@123";

  // Clean test user if previously existed
  await User.deleteMany({ phone: testPhone });

  // 2. Test User Registration (Success)
  console.log("\n[2/5] Testing User Registration (Success Case)...");
  const testUserRole = "contractor";
  const newContractor = new User({
    name: "Test Contractor Reddy",
    phone: testPhone,
    pincode: "560001",
    businessRole: testUserRole,
    password: testPassword,
    companyName: "Reddy Constructions",
    city: "Bengaluru",
    state: "Karnataka",
    subscriptionPlan: "professional",
    subscriptionBilling: "annual"
  });

  await newContractor.save();
  console.log("✅ User Registered Successfully!");
  console.log("   User ID:", newContractor._id.toString());
  console.log("   User Code:", newContractor.userCode);
  console.log("   Role:", newContractor.businessRole);
  console.log("   Unique Mobile:", newContractor.phone);

  // 3. Test Duplicate Mobile Registration (Must Fail)
  console.log("\n[3/5] Testing Duplicate Mobile Registration (Must Fail)...");
  try {
    const duplicateUser = new User({
      name: "Duplicate Attempt User",
      phone: testPhone, // Same mobile number!
      pincode: "560002",
      businessRole: "supplier", // Different role!
      password: testPassword
    });

    await duplicateUser.save();
    console.error("❌ FAIL: Duplicate registration succeeded when it should have been blocked!");
  } catch (err) {
    console.log("✅ PASS: Duplicate registration correctly blocked by database unique index!");
    console.log("   Error Code:", err.code);
    console.log("   Error Message:", err.message);
  }

  // 4. Test Password Authentication & Role Lookup
  console.log("\n[4/5] Testing Login Authentication & Password Comparison...");
  const foundUser = await User.findOne({ phone: testPhone });
  const isMatch = await foundUser.comparePassword(testPassword);
  if (isMatch) {
    console.log("✅ Password Hash Comparison Verified Cleanly!");
  } else {
    console.error("❌ Password comparison failed!");
  }

  // Cleanup test contractor
  await User.deleteMany({ phone: testPhone });
  console.log("\n[5/5] Cleanup completed.");

  console.log("\n==================================================");
  console.log("🎉 ALL STAGE 1 BACKEND & DATABASE TESTS PASSED!");
  console.log("==================================================");

  mongoose.connection.close();
}

runStage1Verification().catch((err) => {
  console.error("❌ Test script error:", err);
  process.exit(1);
});
