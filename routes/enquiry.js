const express = require("express");
const router = express.Router();
const Enquiry = require("../models/Enquiry");
const MarketplaceListing = require("../models/MarketplaceListing");

router.post("/", async (req, res) => {
  try {
    const providerUserCode = String(req.body.providerUserCode || "").trim();
    const buyerName = String(req.body.buyerName || "").trim();
    const buyerPhone = String(req.body.buyerPhone || "").trim();

    if (!providerUserCode) return res.status(400).json({ success: false, message: "providerUserCode is required" });
    if (!buyerName) return res.status(400).json({ success: false, message: "buyerName is required" });
    if (!buyerPhone) return res.status(400).json({ success: false, message: "buyerPhone is required" });

    const count = await Enquiry.countDocuments();
    const enquiryCode = "ENQ-" + String(count + 1).padStart(6, "0");

    const enquiry = await Enquiry.create({
      enquiryCode,
      ...req.body,
      providerUserCode,
      buyerName,
      buyerPhone
    });

    res.json({ success: true, enquiry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/code/:enquiryCode", async (req, res) => {
  try {
    let enquiry = await Enquiry.findOne({ enquiryCode: req.params.enquiryCode }).lean();
    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });

    const listing = await MarketplaceListing.findOne({
      providerUserCode: enquiry.providerUserCode,
      itemName: enquiry.itemName,
      status: "approved",
      isActive: true,
      isBlocked: false
    }).lean();

    if (listing) {
      enquiry.uploadedRate = listing.rate;
      enquiry.uploadedUnit = listing.unit;
      enquiry.gst = listing.gst;
      enquiry.listingCode = listing.listingCode;
      enquiry.masterItemCode = listing.masterItemCode;
    }

    res.json({ success: true, enquiry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put("/code/:enquiryCode/reject", async (req, res) => {
  try {
    const enquiry = await Enquiry.findOneAndUpdate(
      { enquiryCode: req.params.enquiryCode },
      { status: "Rejected", quoteMessage: req.body.reason || "Rejected by supplier" },
      { new: true }
    );
    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });
    res.json({ success: true, enquiry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.providerUserCode) filter.providerUserCode = req.query.providerUserCode;
    if (req.query.buyerUserCode) filter.buyerUserCode = req.query.buyerUserCode;

    const enquiries = await Enquiry.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, enquiries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put("/:id/quote", async (req, res) => {
  try {
    if (req.body.quotedAmount === undefined || req.body.quotedAmount === null || req.body.quotedAmount === "") {
      return res.status(400).json({ success: false, message: "quotedAmount is required" });
    }

    const enquiry = await Enquiry.findByIdAndUpdate(
      req.params.id,
      {
        status: "Quoted",
        quotedAmount: req.body.quotedAmount,
        quoteMessage: req.body.quoteMessage,
        quotedDate: new Date().toISOString().split("T")[0]
      },
      { new: true }
    );

    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });

    res.json({ success: true, enquiry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
