require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

async function audit() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");

    const phone = "7676942386";

    const users = await User.find({
      $or: [
        { phone: phone },
        { phone: "+91" + phone },
        { phone: "91" + phone }
      ]
    }).select("-password").lean();

    console.log("\n===== USERS USING MOBILE 7676942386 =====");
    console.log(JSON.stringify(users, null, 2));

    console.log("\nTotal matching users:", users.length);

    const duplicatePhones = await User.aggregate([
      {
        $match: {
          phone: { $exists: true, $nin: [null, ""] }
        }
      },
      {
        $group: {
          _id: "$phone",
          count: { $sum: 1 },
          users: {
            $push: {
              id: "$_id",
              name: "$name",
              email: "$email",
              phone: "$phone",
              userCode: "$userCode",
              businessRole: "$businessRole",
              role: "$role"
            }
          }
        }
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log("\n===== ALL DUPLICATE MOBILE NUMBERS =====");
    console.log(JSON.stringify(duplicatePhones, null, 2));

  } catch (error) {
    console.error("AUDIT ERROR:", error);
  } finally {
    await mongoose.disconnect();
  }
}

audit();
