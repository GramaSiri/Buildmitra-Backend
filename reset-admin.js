const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
require("dotenv").config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const password = await bcrypt.hash("admin123", 10);

  const user = await User.findOneAndUpdate(
    { email: "admin@buildmitra.com" },
    {
      $set: {
        password,
        role: "admin",
        businessRole: "admin",
        isVerified: true,
        phone: "9999999999"
      }
    },
    { new: true }
  );

  console.log(user ? "✅ Admin reset done: admin@buildmitra.com / admin123" : "❌ Admin not found");
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
