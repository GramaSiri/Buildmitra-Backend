const mongoose = require("mongoose");
const User = require("./models/User");
require("dotenv").config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/buildmitra");

    const user = await User.findOne({ phone: "9731888377" });

    if (!user) {
      console.log("❌ Buyer not found");
    } else {
      console.log({
        name: user.name,
        phone: user.phone,
        email: user.email,
        businessRole: user.businessRole,
        role: user.role,
        userCode: user.userCode
      });
    }

    await mongoose.disconnect();
  } catch (e) {
    console.error(e);
  }
})();
