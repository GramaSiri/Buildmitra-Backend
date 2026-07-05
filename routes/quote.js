const express = require("express");
const router = express.Router();
const Quote = require("../models/Quote");
const Enquiry = require("../models/Enquiry");
const Counter = require("../models/Counter");

async function generateCode(prefix) {
  const counter = await Counter.findOneAndUpdate(
    { key: prefix },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${prefix}-${String(counter.seq).padStart(6, "0")}`;
}

// Provider replies quote
router.post("/create", async (req, res) => {
  try {
    const quoteCode = await generateCode("QTE");

    const quote = new Quote({
      ...req.body,
      quoteCode,
      whatsappMessage: `BuildMitra Quote ${quoteCode}: Rate ${req.body.rate}, Total ${req.body.totalAmount}, Delivery ${req.body.deliveryTime}`
    });

    await quote.save();

    await Enquiry.updateOne(
      { enquiryCode: req.body.enquiryCode },
      { $set: { status: "quoted" } }
    );

    res.json({ success: true, quote });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Buyer receives quotes
router.get("/enquiry/:enquiryCode", async (req, res) => {
  try {
    const quotes = await Quote.find({
      enquiryCode: req.params.enquiryCode
    }).sort({ createdAt: -1 });

    res.json({ success: true, quotes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
