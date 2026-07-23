const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI;

const EnquirySchema = new mongoose.Schema({}, { collection: "enquiries", strict: false });
const Enquiry = mongoose.models.Enquiry || mongoose.model("Enquiry", EnquirySchema);

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    const all = await Enquiry.find().lean();
    console.log(`TOTAL RECORDS: ${all.length}\n`);
    all.forEach(e => {
      console.log(`code: ${e.enquiryCode} | buyer: "${e.buyerUserCode}" | provider: "${e.providerUserCode}" | assigned: "${e.assignedProviderUserCode}" | item: "${e.itemName}"`);
    });
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
