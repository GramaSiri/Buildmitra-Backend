const express = require('express');
const router = express.Router();
const Quote = require('../models/Quote');
const Enquiry = require('../models/Enquiry');
const Counter = require('../models/Counter');

function text(str) {
  return String(str || '').trim();
}

async function generateCode(prefix) {
  const counter = await Counter.findOneAndUpdate(
    { key: prefix },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return prefix + '-' + String(counter.seq).padStart(6, '0');
}

// Create a new Quote
router.post('/create', async (req, res) => {
  try {
    const enquiryCode = text(req.body.enquiryCode);
    if (!enquiryCode) {
      return res.status(400).json({ success: false, message: 'enquiryCode is required' });
    }

    const enquiry = await Enquiry.findOne({ enquiryCode });
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }

    const quoteCode = await generateCode('QTE');

    const providerUserCode = text(req.body.providerUserCode || enquiry.assignedProviderUserCode || enquiry.providerUserCode);
    const buyerUserCode = text(req.body.buyerUserCode || enquiry.buyerUserCode);

    const quantity = Number(req.body.quantity) || Number(enquiry.quantity) || 1;
    const rate = Number(req.body.rate) || 0;
    const items = Array.isArray(req.body.items) ? req.body.items : [];

    let subtotal = Number(req.body.subtotal) || 0;
    if (!subtotal) {
      if (items.length > 0) {
        subtotal = items.reduce((sum, item) => sum + (Number(item.quantity || 1) * Number(item.rate || 0)), 0);
      } else {
        subtotal = rate * quantity;
      }
    }

    const gstAmount = Number(req.body.gstAmount) || 0;
    const transportCharges = Number(req.body.transportCharges) || 0;
    const loadingCharges = Number(req.body.loadingCharges) || 0;
    const unloadingCharges = Number(req.body.unloadingCharges) || 0;
    const discount = Number(req.body.discount) || 0;

    const grandTotal = Number(req.body.grandTotal || req.body.totalAmount) ||
      (subtotal + gstAmount + transportCharges + loadingCharges + unloadingCharges - discount);

    const quote = await Quote.create({
      quoteCode,
      enquiryCode: enquiry.enquiryCode,
      batchCode: text(req.body.batchCode || enquiry.batchCode),

      buyerUserCode,
      buyerName: text(req.body.buyerName || enquiry.buyerName),
      buyerPhone: text(req.body.buyerPhone || enquiry.buyerPhone),

      providerUserCode,
      providerName: text(req.body.providerName || enquiry.providerName || enquiry.assignedProviderName),
      providerPhone: text(req.body.providerPhone || enquiry.providerPhone || enquiry.assignedProviderPhone),
      providerRole: text(req.body.providerRole || enquiry.providerRole || enquiry.assignedProviderRole),

      items,
      rate,
      quantity,
      unit: text(req.body.unit || enquiry.unit),

      subtotal,
      gstAmount,
      transportCharges,
      loadingCharges,
      unloadingCharges,
      discount,

      totalAmount: grandTotal,
      grandTotal,

      deliveryTime: req.body.deliveryTime || '',
      terms: req.body.terms || '',
      remarks: req.body.remarks || '',

      attachmentUrl: req.body.attachmentUrl || null,
      attachmentName: req.body.attachmentName || null,
      status: 'sent',
      whatsappMessage: req.body.whatsappMessage || ''
    });

    // Target 5 Flow: Update linked enquiry
    await Enquiry.updateOne(
      { enquiryCode: enquiry.enquiryCode },
      {
        $set: {
          status: 'Quote Submitted',
          quoteStatus: 'quoted',
          quoteCode: quote.quoteCode,
          quotedAmount: grandTotal,
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

// GET Quotes by Enquiry Code
router.get('/enquiry/:enquiryCode', async (req, res) => {
  try {
    const quotes = await Quote.find({ enquiryCode: req.params.enquiryCode }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, count: quotes.length, quotes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET Quotes for Provider
router.get('/provider/:providerUserCode', async (req, res) => {
  try {
    const providerUserCode = text(req.params.providerUserCode);
    const regex = new RegExp('^' + providerUserCode.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i');
    const quotes = await Quote.find({ providerUserCode: regex }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, count: quotes.length, quotes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET Quotes for Buyer (Target 2: supporting direct buyerUserCode and linked enquiry matching)
router.get('/buyer/:buyerUserCode', async (req, res) => {
  try {
    const buyerUserCode = text(req.params.buyerUserCode);
    const regex = new RegExp('^' + buyerUserCode.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i');

    const buyerEnquiries = await Enquiry.find({ buyerUserCode: regex }).select('enquiryCode').lean();
    const buyerEnquiryCodes = buyerEnquiries.map(e => e.enquiryCode);

    const quotes = await Quote.find({
      $or: [
        { buyerUserCode: regex },
        { enquiryCode: { $in: buyerEnquiryCodes } }
      ]
    }).sort({ createdAt: -1 }).lean();

    res.json({ success: true, count: quotes.length, quotes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Target 5 Status Actions: View, Accept, Reject
router.post('/:quoteCode/view', async (req, res) => {
  try {
    const quoteCode = text(req.params.quoteCode);
    const quote = await Quote.findOneAndUpdate(
      { quoteCode },
      { $set: { status: 'Viewed' } },
      { new: true }
    );
    if (quote) {
      await Enquiry.updateOne({ enquiryCode: quote.enquiryCode }, { $set: { status: 'Quote Received' } });
    }
    res.json({ success: true, quote });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:quoteCode/accept', async (req, res) => {
  try {
    const quoteCode = text(req.params.quoteCode);
    const quote = await Quote.findOneAndUpdate(
      { quoteCode },
      { $set: { status: 'Accepted' } },
      { new: true }
    );
    if (quote) {
      await Enquiry.updateOne({ enquiryCode: quote.enquiryCode }, { $set: { status: 'Accepted' } });
    }
    res.json({ success: true, quote });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:quoteCode/reject', async (req, res) => {
  try {
    const quoteCode = text(req.params.quoteCode);
    const quote = await Quote.findOneAndUpdate(
      { quoteCode },
      { $set: { status: 'Rejected' } },
      { new: true }
    );
    if (quote) {
      await Enquiry.updateOne({ enquiryCode: quote.enquiryCode }, { $set: { status: 'Rejected' } });
    }
    res.json({ success: true, quote });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all quotes
router.get('/all', async (req, res) => {
  try {
    const quotes = await Quote.find({}).sort({ createdAt: -1 }).limit(20).lean();
    res.json({ success: true, count: quotes.length, quotes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
