const mongoose = require("mongoose");
require("dotenv").config({ path: ".env.local" });
if (!process.env.MONGO_URI) {
  require("dotenv").config();
}

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/Buildmitra";

const UserSchema = new mongoose.Schema({}, { strict: false, collection: "users" });
const User = mongoose.models.User || mongoose.model("User", UserSchema);

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB Connected!");
    
    const users = await User.find().limit(20);
    console.log(`📊 TOTAL USERS COUNT: ${users.length}`);
    users.forEach((u) => {
      console.log(`UserCode: ${u.userCode || u.uniqueCode || u._id} | Role: ${u.role || u.businessRole} | Name: ${u.name} | Phone: ${u.phone}`);
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
