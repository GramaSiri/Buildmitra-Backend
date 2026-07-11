const mongoose = require("mongoose");
const User = require("./models/User");
require("dotenv").config();

async function run() {
  const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/buildmitra";
  await mongoose.connect(MONGODB_URI);

  const user = await User.findOne({ email: "admin@buildmitra.com" });
  if (!user) {
    console.log("❌ Admin not found");
    process.exit(1);
  }

  user.password = "admin123";
  user.role = "admin";
  user.businessRole = "admin";
  user.isVerified = true;
  user.isActive = true;
  user.phone = "9999999999";

  await user.save();

  console.log("✅ Admin reset done");
  console.log("Email: admin@buildmitra.com");
  console.log("Password: admin123");

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
