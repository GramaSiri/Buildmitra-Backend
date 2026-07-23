require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

const email = process.argv[2];

const uri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.MONGODB_URL ||
  process.env.DATABASE_URL;

(async () => {
  try {
    await mongoose.connect(uri);

    const user = await User.findOneAndUpdate(
      {
        email: new RegExp(`^${email}$`, "i")
      },
      {
        $set: {
          businessRole: "realestate"
        }
      },
      {
        new: true,
        runValidators: true
      }
    )
      .select("_id name email phone userCode role businessRole")
      .lean();

    console.log(user || "USER_NOT_FOUND");
  } catch (error) {
    console.error(error.message);
  } finally {
    await mongoose.disconnect();
  }
})();
