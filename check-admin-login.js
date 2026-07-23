require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question("Enter actual admin password: ", async (enteredPassword) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("\nDatabase:", mongoose.connection.name);

    const users = await User.find({
      email: {
        $regex: "^admin@buildmitra\\.com$",
        $options: "i"
      }
    })
      .select(
        "_id name email phone userCode uniqueCode role businessRole password isVerified createdAt"
      )
      .lean();

    console.log("Matching admin accounts:", users.length);

    for (const user of users) {
      let passwordMatches = false;

      try {
        passwordMatches = await bcrypt.compare(
          enteredPassword,
          user.password || ""
        );
      } catch (error) {
        passwordMatches = false;
      }

      console.log({
        id: String(user._id),
        name: user.name,
        email: user.email,
        phone: user.phone,
        userCode: user.userCode,
        uniqueCode: user.uniqueCode,
        role: user.role,
        businessRole: user.businessRole,
        isVerified: user.isVerified,
        passwordExists: Boolean(user.password),
        passwordLength: user.password ? user.password.length : 0,
        passwordLooksHashed: Boolean(
          user.password && user.password.startsWith("$2")
        ),
        enteredPasswordMatches: passwordMatches,
        createdAt: user.createdAt
      });
    }

    if (users.length === 0) {
      console.log("ADMIN_USER_NOT_FOUND");
    }
  } catch (error) {
    console.error("DIAGNOSTIC_ERROR:", error.message);
  } finally {
    await mongoose.disconnect();
    rl.close();
  }
});
