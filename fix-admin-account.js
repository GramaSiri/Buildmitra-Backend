require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

const uri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.MONGODB_URL ||
  process.env.DATABASE_URL ||
  "mongodb://localhost:27017/buildmitra";

(async () => {
  try {
    await mongoose.connect(uri);

    console.log("Connected database:", mongoose.connection.name);

    const adminEmail = "admin@buildmitra.com";
    const adminPhone = "7676942386";
    const newPassword = "Admin@123";

    let admin = await User.findOne({
      $or: [
        { email: adminEmail },
        { phone: adminPhone }
      ]
    });

    if (!admin) {
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      admin = await User.create({
        name: "BuildMitra Admin",
        email: adminEmail,
        phone: adminPhone,
        password: hashedPassword,
        role: "admin",
        businessRole: "admin",
        isVerified: true
      });

      console.log("Admin account created.");
    } else {
      admin.email = adminEmail;
      admin.phone = adminPhone;
      admin.role = "admin";
      admin.businessRole = "admin";
      admin.isVerified = true;
      admin.password = newPassword;

      await admin.save();

      console.log("Admin account corrected.");
    }

    console.log({
      id: String(admin._id),
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      role: admin.role,
      businessRole: admin.businessRole,
      isVerified: admin.isVerified
    });
  } catch (error) {
    console.error("ERROR:", error.message);
  } finally {
    await mongoose.disconnect();
  }
})();
