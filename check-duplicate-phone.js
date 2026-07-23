require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

async function checkUsers() {
  try {
    const mongoUri =
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/buildmitra";

    await mongoose.connect(mongoUri);

    console.log("DATABASE:", mongoose.connection.name);
    console.log("HOST:", mongoose.connection.host);

    const phone = "7676942386";
    const variants = [
      phone,
      `+91${phone}`,
      `91${phone}`,
      `0${phone}`
    ];

    const users = await User.find({
      $or: [
        { phone: { $in: variants } },
        { mobile: { $in: variants } },
        { phoneNumber: { $in: variants } },
        { whatsappNumber: { $in: variants } },
        { name: /maruthi/i },
        { businessName: /maruthi/i },
        { companyName: /maruthi/i }
      ]
    })
      .select("-password")
      .lean();

    console.log("\nMATCHED USERS:");
    console.log(JSON.stringify(users, null, 2));

    console.log("\nUSER INDEXES:");
    console.log(
      JSON.stringify(await User.collection.indexes(), null, 2)
    );

    console.log("\nTOTAL USERS:", await User.countDocuments());
  } catch (error) {
    console.error("CHECK FAILED:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkUsers();

