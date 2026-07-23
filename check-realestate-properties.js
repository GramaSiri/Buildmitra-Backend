require("dotenv").config();
const mongoose = require("mongoose");
const RealEstateProperty = require("./models/RealEstateProperty");

const uri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.MONGODB_URL ||
  process.env.DATABASE_URL ||
  "mongodb://localhost:27017/buildmitra";

(async () => {
  try {
    await mongoose.connect(uri);

    console.log("Database:", mongoose.connection.name);

    const properties = await RealEstateProperty.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select(
        "propertyCode title propertyType transactionType city providerName providerPhone providerUserCode status approvalStatus createdAt"
      )
      .lean();

    console.log(JSON.stringify(properties, null, 2));
  } catch (error) {
    console.error("ERROR:", error.message);
  } finally {
    await mongoose.disconnect();
  }
})();
