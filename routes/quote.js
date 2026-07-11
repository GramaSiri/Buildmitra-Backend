const express = require('express');
const router = express.Router();
const Quote = require('../models/Quote');
const Enquiry = require('../models/Enquiry');
const Counter = require('../models/Counter');

async function generateCode(prefix) {
  const counter = await Counter.findOneAndUpdate(
    { key: prefix },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return prefix + '-' + String(counter.seq).padStart(6, '0');
}

router.post('/create', async (req, res) => {
  try {
    if (!req.body.enquiryCode) {
      return res.status(400).json({ success: false, message: 'enquiryCode is required' });
    }

    const enquiry = await Enquiry.findOne({ enquiryCode: req.body.enquiryCode });
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }

    const quoteCode = await generateCode('QTE');

    const quote = await Quote.create({
      quoteCode: quoteCode,
      enquiryCode: enquiry.enquiryCode,
      providerUserCode: enquiry.providerUserCode,
      providerName: req.body.providerName || enquiry.providerName,
      providerPhone: req.body.providerPhone || enquiry.providerPhone,
      rate: Number(req.body.rate) || 0,
      quantity: Number(req.body.quantity) || Number(enquiry.quantity) || 0,
      totalAmount: Number(req.body.totalAmount) || Number(req.body.rate) || 0,
      deliveryTime: req.body.deliveryTime,
      terms: req.body.terms,
      remarks: req.body.remarks,
      attachmentUrl: req.body.attachmentUrl || null,
      attachmentName: req.body.attachmentName || null,
      status: 'sent',
      whatsappMessage: req.body.whatsappMessage || ''
    });

    // Update enquiry status
    await Enquiry.updateOne(
      { enquiryCode: enquiry.enquiryCode },
      {
        $set: {
          status: 'Quoted',
          quotedAmount: Number(req.body.totalAmount || req.body.rate || 0),
          quoteMessage: req.body.remarks || req.body.terms || 'Quote sent',
          quotedDate: new Date().toISOString().split('T')[0]
        }
      }
    );

    res.json({ success: true, quote, enquiry });
  } catch (error) {
    console.error('Quote create error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/enquiry/:enquiryCode', async (req, res) => {
  try {
    const quotes = await Quote.find({ enquiryCode: req.params.enquiryCode }).sort({ createdAt: -1 });
    res.json({ success: true, quotes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/provider/:providerUserCode', async (req, res) => {
  try {
    const quotes = await Quote.find({ providerUserCode: req.params.providerUserCode }).sort({ createdAt: -1 });
    res.json({ success: true, quotes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all quotes (for testing)
router.get('/all', async (req, res) => {
  try {
    const quotes = await Quote.find({}).sort({ createdAt: -1 }).limit(10);
    res.json({ success: true, count: quotes.length, quotes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
