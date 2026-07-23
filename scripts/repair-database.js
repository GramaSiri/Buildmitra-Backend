const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI;

const Quote = require("../models/Quote");
const Enquiry = require("../models/Enquiry");

async function run() {
  try {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB Atlas Connected!");

    // 1. Repair QTE-000001
    const q1 = await Quote.findOne({ quoteCode: "QTE-000001" });
    if (q1) {
      q1.buyerUserCode = "BUY-000001";
      q1.buyerName = "Jai Sri Ram";
      q1.buyerPhone = "9731888377";
      q1.rate = 67;
      q1.quantity = 100;
      q1.subtotal = 6700;
      q1.totalAmount = 6700;
      q1.grandTotal = 6700;
      q1.status = "sent";
      await q1.save();
      console.log("✅ Repaired QTE-000001 successfully:", {
        quoteCode: q1.quoteCode,
        enquiryCode: q1.enquiryCode,
        buyerUserCode: q1.buyerUserCode,
        providerUserCode: q1.providerUserCode,
        rate: q1.rate,
        quantity: q1.quantity,
        totalAmount: q1.totalAmount,
        grandTotal: q1.grandTotal,
        status: q1.status
      });
    } else {
      // Create QTE-000001 if missing
      const newQ = new Quote({
        quoteCode: "QTE-000001",
        enquiryCode: "ENQ-000005",
        buyerUserCode: "BUY-000001",
        buyerName: "Jai Sri Ram",
        buyerPhone: "9731888377",
        providerUserCode: "SUP-000005",
        providerName: "Jai Sri Krishna",
        rate: 67,
        quantity: 100,
        subtotal: 6700,
        totalAmount: 6700,
        grandTotal: 6700,
        status: "sent"
      });
      await newQ.save();
      console.log("✅ Created QTE-000001 cleanly:", newQ.quoteCode);
    }

    // 2. Verify ENQ-000005 linkage
    const e5 = await Enquiry.findOne({ enquiryCode: "ENQ-000005" });
    if (e5) {
      console.log("✅ ENQ-000005 status:", {
        enquiryCode: e5.enquiryCode,
        buyerUserCode: e5.buyerUserCode,
        providerUserCode: e5.providerUserCode,
        assignedProviderUserCode: e5.assignedProviderUserCode,
        status: e5.status
      });
    }

    await mongoose.disconnect();
    console.log("🎉 Database Repair Complete!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Repair failed:", err);
    process.exit(1);
  }
}

run();
