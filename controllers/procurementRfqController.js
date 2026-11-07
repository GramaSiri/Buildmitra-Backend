const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const ProcurementRfq = require('../models/ProcurementRfq');
const SupplierRfq = require('../models/SupplierRfq');
const SupplierQuote = require('../models/SupplierQuote');
const ReverseAuctionBid = require('../models/ReverseAuctionBid');
const RfqAuditLog = require('../models/RfqAuditLog');
const WhatsappLog = require('../models/WhatsappLog');
const User = require('../models/User');
const MasterItem = require('../models/MasterItem');
const Enquiry = require('../models/Enquiry');
const { filterSuppliersWithinRadius, generateMaskedCodeName, getRegisteredSupplier, DEFAULT_VERIFIED_SUPPLIERS } = require('../services/geoFenceService');
const { buildProfessionalPoPdf } = require('../services/poPdfService');
const { sendWhatsAppMessage } = require('../services/whatsappService');

/**
 * Generate unique codes
 */
const generateBatchCode = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `BM-RFQ-${dateStr}-${rand}`;
};

const generateEnquiryCode = (batchCode, index) => {
  return `${batchCode.replace('BM-RFQ-', 'BM-ENQ-')}-${index + 1}`;
};

/**
 * Helper: Find matching explicitly registered suppliers: "Jai Hanuman", "Jai Sri Rama", and "Sri Krishna"
 */
const findMatchingSuppliers = async (pincode, categories = [], limit = 5) => {
  try {
    const allowedPhones = ['9845012345', '9731888377', '7676942386'];
    const allowedNames = [/jai hanuman/i, /jai sri rama/i, /jai sri ram/i, /sri krishna/i, /jai sri krishna/i];

    let suppliers = await User.find({
      $or: [
        { phone: { $in: allowedPhones } },
        { name: { $in: allowedNames } },
        { userCode: { $in: ['SUP-000004', 'BUY-000001', 'SUP-000005'] } }
      ],
      isActive: true
    })
    .select('name companyName phone officePhone email userCode businessRole pincode city address gstNo')
    .lean();

    if (!suppliers || suppliers.length === 0) {
      suppliers = DEFAULT_VERIFIED_SUPPLIERS.map(s => ({
        userCode: s.userCode,
        name: s.name,
        companyName: s.companyName,
        phone: s.phone,
        officePhone: s.phone,
        email: s.email || '',
        businessRole: 'supplier',
        pincode: s.pincode,
        city: s.city,
        address: s.address,
        gstNo: s.verifiedGst
      }));
    }

    return suppliers;
  } catch (error) {
    console.error('Error finding matching suppliers:', error);
    return DEFAULT_VERIFIED_SUPPLIERS;
  }
};

/**
 * 1. POST /api/procurement/rfq/create — Create & Launch RFQ Batch
 */
exports.createRfq = async (req, res) => {
  try {
    const {
      buyerUserCode,
      buyerName,
      buyerPhone,
      buyerEmail,
      items,
      deliverySite,
      selectedSupplierCodes,
      auctionDurationHours = 5,
      minDecrement = 10
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one line item is required.' });
    }

    if (!deliverySite || !deliverySite.address || !deliverySite.pincode) {
      return res.status(400).json({ success: false, message: 'Delivery site address and pincode are required.' });
    }

    const batchCode = generateBatchCode();

    // Process and validate items
    let grandTotalEstValue = 0;
    const processedItems = items.map((item, idx) => {
      const qty = Number(item.quantity || item.qty || 1);
      const targetRate = Number(item.targetRate || item.rate || 0);
      const estTotal = qty * targetRate;
      grandTotalEstValue += estTotal;

      return {
        itemCode: item.itemCode || `ITEM-${idx + 1}`,
        itemName: item.itemName || item.materialName || 'Construction Material',
        category: item.category || item.materialCategory || 'General',
        quantity: qty,
        unit: (item.unit || 'BAGS').toUpperCase(),
        targetRate: targetRate,
        estTotal: estTotal,
        remarks: item.remarks || ''
      };
    });

    // Create main RFQ record
    const rfq = new ProcurementRfq({
      batchCode,
      title: `Bulk Procurement (${processedItems.map(i => i.itemName).join(', ')})`.slice(0, 80),
      buyerUserCode: buyerUserCode || 'BUY-GUEST',
      buyerName: buyerName || 'BuildMitra Buyer',
      buyerPhone: buyerPhone || '+91 9876543210',
      buyerEmail: buyerEmail || '',
      items: processedItems,
      deliverySite: {
        address: deliverySite.address,
        city: deliverySite.city || '',
        pincode: deliverySite.pincode,
        requiredDate: deliverySite.requiredDate || deliverySite.deliveryTimeline || 'Within 2 days',
        paymentTerms: deliverySite.paymentTerms || 'COD on Unloading',
        notes: deliverySite.notes || ''
      },
      grandTotalEstValue,
      auctionSettings: {
        isAuctionActive: false,
        durationHours: Number(auctionDurationHours),
        minDecrement: Number(minDecrement),
        currentL1Rate: grandTotalEstValue
      },
      status: 'BROADCASTED'
    });

    await rfq.save();

    // Determine target suppliers via 25km-50km Geofenced PIN Code matching
    let matchedSuppliers = [];
    if (selectedSupplierCodes && Array.isArray(selectedSupplierCodes) && selectedSupplierCodes.length > 0) {
      matchedSuppliers = await User.find({ userCode: { $in: selectedSupplierCodes } }).lean();
    }
    
    if (matchedSuppliers.length === 0) {
      const categories = [...new Set(processedItems.map(i => i.category))];
      try {
        const geoResult = await filterSuppliersWithinRadius(deliverySite.pincode, categories[0] || 'CEMENT', 25.0, batchCode);
        if (geoResult && geoResult.suppliers && geoResult.suppliers.length > 0) {
          matchedSuppliers = geoResult.suppliers.map((s, idx) => ({
            userCode: s.id || `SUP-${idx + 1}`,
            name: s.companyName,
            companyName: s.companyName,
            phone: s.phone,
            email: s.email || '',
            distanceKm: s.distanceKm,
            maskedCodeName: s.maskedCodeName,
            pincode: s.pincode
          }));
        }
      } catch (err) {
        console.warn("Geofence matching error:", err.message);
      }

      if (matchedSuppliers.length === 0) {
        matchedSuppliers = await findMatchingSuppliers(deliverySite.pincode, categories, 5);
      }
    }

    // Create supplier RFQ records & WhatsApp Share payload
    const supplierRfqList = [];
    const appBaseUrl = process.env.CLIENT_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    for (let i = 0; i < matchedSuppliers.length; i++) {
      const sup = matchedSuppliers[i];
      const enquiryCode = generateEnquiryCode(batchCode, i);
      const quoteToken = crypto.randomBytes(16).toString('hex');
      const maskedCodeName = sup.maskedCodeName || generateMaskedCodeName(sup.userCode || `SUP-${i + 1}`, batchCode);

      const supplierRfq = new SupplierRfq({
        rfqId: rfq._id,
        batchCode,
        enquiryCode,
        supplierUserCode: sup.userCode || `SUP-${i + 1}`,
        supplierName: sup.companyName || sup.name || 'Verified Supplier',
        supplierPhone: sup.phone || sup.officePhone || '',
        supplierEmail: sup.email || '',
        quoteToken,
        status: 'SENT',
        whatsappStatus: 'DELIVERED',
        maskedCodeName
      });

      await supplierRfq.save();

      // Create backward-compatible Enquiry record for admin/provider dashboard
      try {
        const legacyEnquiry = new Enquiry({
          enquiryCode,
          batchCode,
          cartItems: processedItems,
          buyerUserCode: rfq.buyerUserCode,
          buyerName: rfq.buyerName,
          buyerPhone: rfq.buyerPhone,
          buyerEmail: rfq.buyerEmail,
          providerUserCode: sup.userCode || 'ADM-000001',
          providerName: sup.companyName || sup.name,
          providerPhone: sup.phone,
          enquiryCategory: 'marketplace',
          itemName: processedItems[0]?.itemName || 'Bulk Items',
          quantity: String(processedItems[0]?.quantity || 1),
          unit: processedItems[0]?.unit || 'BAGS',
          location: deliverySite.address,
          pincode: deliverySite.pincode,
          adminApprovalStatus: 'approved',
          status: 'New'
        });
        await legacyEnquiry.save();
      } catch (e) {
        console.error('Error creating legacy enquiry:', e.message);
      }

      const quoteUrl = `${appBaseUrl}/rfq/quote/${quoteToken}?quick=true`;
      const liveAuctionUrl = `${appBaseUrl}/live-reverse-auction?batchCode=${batchCode}`;
      const itemSummary = processedItems.map(it => `• ${it.itemName} (${it.quantity} ${it.unit})`).join('\n');
      
      const messageText = `*BUILDMITRA BULK RFQ ALERT (#${batchCode})*\n\nDear *${sup.name || 'Supplier'}* (${sup.distanceKm ? sup.distanceKm + ' km from site' : 'Local Area'}),\nYou have received a bulk enquiry for *${processedItems.length} items* at Pincode *${deliverySite.pincode}*.\n\n*Required Materials:*\n${itemSummary}\n\n*Target Est. Value:* ₹${grandTotalEstValue.toLocaleString('en-IN')}\n\n🔒 *Anonymous Code-Name Assigned:* ${maskedCodeName} (Anti-collusion live bidding)\n\n⚡ *SUBMIT YOUR QUOTE IN 1-CLICK:*\n${quoteUrl}\n\n⚡ *JOIN LIVE REVERSE AUCTION:*\n${liveAuctionUrl}\n\nBuildMitra Automated Procurement Desk`;
      
      const encodedMsg = encodeURIComponent(messageText);
      const cleanPhone = (sup.phone || '').replace(/\D/g, '');
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}&text=${encodedMsg}`;

      // Automatically dispatch via real WhatsApp service
      if (sup.phone) {
        sendWhatsAppMessage(sup.phone, messageText).catch(e => console.warn("WhatsApp dispatch error:", e));
      }

      supplierRfqList.push({
        supplierUserCode: supplierRfq.supplierUserCode,
        supplierName: supplierRfq.supplierName,
        supplierPhone: supplierRfq.supplierPhone,
        enquiryCode: supplierRfq.enquiryCode,
        whatsappStatus: supplierRfq.whatsappStatus,
        quoteToken: supplierRfq.quoteToken,
        maskedCodeName,
        distanceKm: sup.distanceKm || 2.5,
        quoteUrl,
        whatsappUrl
      });

      // Log WhatsApp entry
      await WhatsappLog.create({
        rfqId: rfq._id,
        supplierUserCode: supplierRfq.supplierUserCode,
        supplierPhone: supplierRfq.supplierPhone,
        messageType: 'RFQ_BROADCAST',
        messageContent: messageText,
        deliveryStatus: 'SHARE_READY'
      });
    }

    // Update assigned supplier count
    rfq.assignedSupplierCount = supplierRfqList.length;
    await rfq.save();

    // Create Audit Log
    await RfqAuditLog.create({
      rfqId: rfq._id,
      batchCode: rfq.batchCode,
      action: 'RFQ_CREATED',
      performedByRole: 'buyer',
      performedByUserCode: rfq.buyerUserCode,
      details: { supplierCount: supplierRfqList.length, estValue: grandTotalEstValue }
    });

    return res.status(201).json({
      success: true,
      message: `RFQ Batch ${batchCode} created successfully! Broadcast ready for ${supplierRfqList.length} suppliers.`,
      batchCode,
      rfq,
      suppliers: supplierRfqList
    });

  } catch (error) {
    console.error('Error creating RFQ batch:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2. POST /api/procurement/rfq/whatsapp-bid — Direct WhatsApp 1-Click Quick Reply Bid
 */
exports.submitWhatsappQuickBid = async (req, res) => {
  try {
    const { batchCode, supplierPhone, supplierUserCode, rate, itemRates } = req.body;

    const rfq = await ProcurementRfq.findOne({ batchCode });
    if (!rfq) {
      return res.status(404).json({ success: false, message: 'RFQ Batch not found.' });
    }

    let supplierRfq;
    if (supplierUserCode) {
      supplierRfq = await SupplierRfq.findOne({ rfqId: rfq._id, supplierUserCode });
    } else if (supplierPhone) {
      const clean = supplierPhone.replace(/\D/g, '').slice(-10);
      supplierRfq = await SupplierRfq.findOne({
        rfqId: rfq._id,
        supplierPhone: { $regex: clean }
      });
    }

    if (!supplierRfq) {
      // Fallback: create temporary assignment for responding verified supplier
      const supUser = await User.findOne({ phone: { $regex: supplierPhone.replace(/\D/g, '').slice(-10) } }).lean();
      supplierRfq = new SupplierRfq({
        rfqId: rfq._id,
        batchCode: rfq.batchCode,
        enquiryCode: generateEnquiryCode(rfq.batchCode, Math.floor(Math.random() * 90)),
        supplierUserCode: supUser ? supUser.userCode : `SUP-WA-${Date.now()}`,
        supplierName: supUser ? (supUser.companyName || supUser.name) : 'WhatsApp Supplier',
        supplierPhone: supplierPhone || '',
        quoteToken: crypto.randomBytes(16).toString('hex'),
        status: 'QUOTED',
        whatsappStatus: 'DELIVERED'
      });
      await supplierRfq.save();
    }

    const defaultRate = Number(rate || 0);

    const lineItems = rfq.items.map((item, idx) => {
      const customRate = itemRates && itemRates[item.itemCode] ? Number(itemRates[item.itemCode]) : defaultRate || item.targetRate;
      const amount = customRate * item.quantity;
      return {
        itemCode: item.itemCode,
        itemName: item.itemName,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        rate: customRate,
        taxPercent: 18,
        amount,
        remarks: 'Submitted via 1-Click WhatsApp Quick Bid'
      };
    });

    const subTotal = lineItems.reduce((acc, curr) => acc + curr.amount, 0);
    const gstTotal = (subTotal * 18) / 100;
    const grandTotal = subTotal + gstTotal;

    const previousQuotes = await SupplierQuote.find({
      rfqId: rfq._id,
      supplierUserCode: supplierRfq.supplierUserCode
    }).sort({ version: -1 });

    const nextVersion = previousQuotes.length > 0 ? previousQuotes[0].version + 1 : 1;
    if (previousQuotes.length > 0) {
      await SupplierQuote.updateMany(
        { rfqId: rfq._id, supplierUserCode: supplierRfq.supplierUserCode },
        { isLatest: false }
      );
    }

    const newQuote = new SupplierQuote({
      rfqId: rfq._id,
      supplierRfqId: supplierRfq._id,
      batchCode: rfq.batchCode,
      enquiryCode: supplierRfq.enquiryCode,
      supplierUserCode: supplierRfq.supplierUserCode,
      supplierName: supplierRfq.supplierName,
      supplierPhone: supplierRfq.supplierPhone,
      version: nextVersion,
      isLatest: true,
      lineItems,
      subTotal,
      freightCharge: 0,
      gstTotal,
      grandTotal,
      deliveryTimelineDays: 1,
      validityDays: 7,
      paymentTermsAccepted: 'COD',
      supplierNotes: '1-Click WhatsApp Quick Quote'
    });

    await newQuote.save();

    supplierRfq.status = 'QUOTED';
    await supplierRfq.save();

    const quotesCount = await SupplierQuote.countDocuments({ rfqId: rfq._id, isLatest: true });
    rfq.quotesCount = quotesCount;
    if (rfq.status === 'BROADCASTED') {
      rfq.status = 'QUOTES_RECEIVED';
    }
    await rfq.save();

    await RfqAuditLog.create({
      rfqId: rfq._id,
      batchCode: rfq.batchCode,
      action: 'WHATSAPP_QUICK_BID_SUBMITTED',
      performedByRole: 'supplier',
      performedByUserCode: supplierRfq.supplierUserCode,
      details: { version: nextVersion, grandTotal }
    });

    return res.status(201).json({
      success: true,
      message: `✅ 1-Click WhatsApp Bid Accepted! Total: ₹${grandTotal.toLocaleString('en-IN')}`,
      quote: newQuote
    });

  } catch (error) {
    console.error('Error submitting WhatsApp quick bid:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3. GET /api/procurement/rfq/eligible-suppliers — 25km-50km Geofenced Supplier Matching with Recommendation Metrics
 */
exports.getEligibleSuppliers = async (req, res) => {
  try {
    const { pincode, category, categories, radius, auctionId } = req.query;
    const targetCats = categories || category || 'CEMENT';
    const maxRadius = radius ? parseFloat(radius) : 25.0;

    const geoResult = await filterSuppliersWithinRadius(pincode || '560078', targetCats, maxRadius, auctionId || '');
    return res.json({
      success: true,
      count: geoResult.matchedCount,
      pincode: geoResult.buyerPincode,
      radiusKm: geoResult.radiusKm,
      suppliers: geoResult.suppliers
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3b. GET /api/procurement/rfq/master-catalog — Dynamic Admin Master Items & Live Rates
 */
exports.getMasterCatalog = async (req, res) => {
  try {
    const { category, subCategory, search } = req.query;
    const filter = { status: 'active' };
    if (category) filter.category = new RegExp(category, 'i');
    if (subCategory) filter.subCategory = new RegExp(subCategory, 'i');
    if (search) {
      filter.$or = [
        { itemName: new RegExp(search, 'i') },
        { brand: new RegExp(search, 'i') },
        { masterItemCode: new RegExp(search, 'i') }
      ];
    }

    const items = await MasterItem.find(filter).sort({ category: 1, itemName: 1 }).lean();
    return res.json({
      success: true,
      count: items.length,
      categories: Array.from(new Set(items.map(i => (i.category || 'GENERAL').toUpperCase()))).sort(),
      items: items.map(m => ({
        id: m.masterItemCode || String(m._id),
        masterItemCode: m.masterItemCode || `MAT-${m._id}`,
        itemName: m.itemName,
        name: m.brand ? `${m.itemName} (${m.brand})` : m.itemName,
        category: (m.category || 'GENERAL').toUpperCase(),
        subCategory: m.subCategory || 'General',
        brand: m.brand || 'Standard Brand',
        grade: m.specification || 'Standard Grade',
        specification: m.specification || '',
        unit: (m.unit || 'BAGS').toUpperCase(),
        benchmarkRate: Number(m.referenceRate || 100),
        gstPercent: Number(m.gst || ((m.category || '').toUpperCase().includes('CEMENT') ? 28 : 18)),
        imageUrl: m.imageUrl || ''
      }))
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 4. GET /api/procurement/rfq/buyer-list — Fetch all RFQs for buyer
 */
exports.getBuyerRfqs = async (req, res) => {
  try {
    const buyerUserCode = req.headers['x-user-code'] || req.query.buyerUserCode;
    const query = buyerUserCode ? { buyerUserCode } : {};

    const rfqs = await ProcurementRfq.find(query).sort({ createdAt: -1 }).lean();

    const enriched = await Promise.all(rfqs.map(async (r) => {
      const quoteCount = await SupplierQuote.countDocuments({ rfqId: r._id, isLatest: true });
      const supplierRfqs = await SupplierRfq.find({ rfqId: r._id }).select('supplierName supplierPhone status whatsappStatus enquiryCode').lean();
      return {
        ...r,
        quotesCount: quoteCount,
        suppliers: supplierRfqs
      };
    }));

    return res.json({ success: true, count: enriched.length, rfqs: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 5. GET /api/procurement/rfq/supplier-list — Fetch assigned RFQs for supplier
 */
exports.getSupplierRfqs = async (req, res) => {
  try {
    const supplierUserCode = req.headers['x-user-code'] || req.query.supplierUserCode;
    if (!supplierUserCode) {
      return res.status(400).json({ success: false, message: 'Supplier user code required.' });
    }

    const supplierRfqs = await SupplierRfq.find({ supplierUserCode })
      .populate('rfqId')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, count: supplierRfqs.length, rfqs: supplierRfqs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 6. GET /api/procurement/rfq/token/:token — View RFQ details for supplier quote portal
 */
exports.getRfqByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const supplierRfq = await SupplierRfq.findOne({ quoteToken: token }).populate('rfqId').lean();

    if (!supplierRfq || !supplierRfq.rfqId) {
      return res.status(404).json({ success: false, message: 'Invalid or expired quote link.' });
    }

    if (supplierRfq.status === 'SENT') {
      await SupplierRfq.findByIdAndUpdate(supplierRfq._id, { status: 'VIEWED', lastViewedAt: new Date() });
    }

    const existingQuotes = await SupplierQuote.find({
      rfqId: supplierRfq.rfqId._id,
      supplierUserCode: supplierRfq.supplierUserCode
    }).sort({ version: -1 }).lean();

    return res.json({
      success: true,
      supplierRfq,
      rfq: supplierRfq.rfqId,
      quoteHistory: existingQuotes,
      latestQuote: existingQuotes[0] || null
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 7. POST /api/procurement/rfq/submit-quote — Submit supplier quote revision
 */
exports.submitSupplierQuote = async (req, res) => {
  try {
    const {
      quoteToken,
      enquiryCode,
      lineItems,
      freightCharge = 0,
      deliveryTimelineDays = 1,
      validityDays = 7,
      paymentTermsAccepted = 'COD',
      supplierNotes = ''
    } = req.body;

    let supplierRfq;
    if (quoteToken) {
      supplierRfq = await SupplierRfq.findOne({ quoteToken }).populate('rfqId');
    } else if (enquiryCode) {
      supplierRfq = await SupplierRfq.findOne({ enquiryCode }).populate('rfqId');
    }

    if (!supplierRfq || !supplierRfq.rfqId) {
      return res.status(404).json({ success: false, message: 'Target RFQ assignment not found.' });
    }

    const rfq = supplierRfq.rfqId;

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Line item rates are required.' });
    }

    let subTotal = 0;
    let gstTotal = 0;

    const processedLineItems = lineItems.map((item) => {
      const rate = Number(item.rate || 0);
      const qty = Number(item.quantity || 1);
      const taxPercent = Number(item.taxPercent || 18);
      const amount = rate * qty;
      const taxAmount = (amount * taxPercent) / 100;

      subTotal += amount;
      gstTotal += taxAmount;

      return {
        itemCode: item.itemCode || '',
        itemName: item.itemName,
        category: item.category || 'General',
        quantity: qty,
        unit: item.unit || 'BAGS',
        rate,
        taxPercent,
        amount,
        remarks: item.remarks || ''
      };
    });

    const grandTotal = subTotal + Number(freightCharge) + gstTotal;

    const previousQuotes = await SupplierQuote.find({
      rfqId: rfq._id,
      supplierUserCode: supplierRfq.supplierUserCode
    }).sort({ version: -1 });

    const nextVersion = previousQuotes.length > 0 ? previousQuotes[0].version + 1 : 1;

    if (previousQuotes.length > 0) {
      await SupplierQuote.updateMany(
        { rfqId: rfq._id, supplierUserCode: supplierRfq.supplierUserCode },
        { isLatest: false }
      );
    }

    const newQuote = new SupplierQuote({
      rfqId: rfq._id,
      supplierRfqId: supplierRfq._id,
      batchCode: rfq.batchCode,
      enquiryCode: supplierRfq.enquiryCode,
      supplierUserCode: supplierRfq.supplierUserCode,
      supplierName: supplierRfq.supplierName,
      supplierPhone: supplierRfq.supplierPhone,
      version: nextVersion,
      isLatest: true,
      lineItems: processedLineItems,
      subTotal,
      freightCharge: Number(freightCharge),
      gstTotal,
      grandTotal,
      deliveryTimelineDays: Number(deliveryTimelineDays),
      validityDays: Number(validityDays),
      paymentTermsAccepted,
      supplierNotes
    });

    await newQuote.save();

    supplierRfq.status = 'QUOTED';
    await supplierRfq.save();

    const quotesCount = await SupplierQuote.countDocuments({ rfqId: rfq._id, isLatest: true });
    rfq.quotesCount = quotesCount;
    if (rfq.status === 'BROADCASTED') {
      rfq.status = 'QUOTES_RECEIVED';
    }
    await rfq.save();

    await RfqAuditLog.create({
      rfqId: rfq._id,
      batchCode: rfq.batchCode,
      action: 'QUOTE_SUBMITTED',
      performedByRole: 'supplier',
      performedByUserCode: supplierRfq.supplierUserCode,
      details: { version: nextVersion, grandTotal }
    });

    return res.status(201).json({
      success: true,
      message: `Quote V${nextVersion} submitted successfully! Total: ₹${grandTotal.toLocaleString('en-IN')}`,
      quote: newQuote
    });

  } catch (error) {
    console.error('Error submitting quote:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 8. GET /api/procurement/rfq/tabulation/:batchCode — BI Comparison Matrix
 */
exports.getTabulationMatrix = async (req, res) => {
  try {
    const { batchCode } = req.params;
    const rfq = await ProcurementRfq.findOne({ batchCode }).lean();

    if (!rfq) {
      return res.status(404).json({ success: false, message: 'RFQ Batch not found.' });
    }

    const quotes = await SupplierQuote.find({ rfqId: rfq._id, isLatest: true }).lean();
    const supplierRfqs = await SupplierRfq.find({ rfqId: rfq._id }).lean();

    const itemMatrix = rfq.items.map((rfqItem) => {
      const supplierRates = quotes.map((q) => {
        const itemInQuote = q.lineItems.find(li => li.itemName.toLowerCase() === rfqItem.itemName.toLowerCase() || li.itemCode === rfqItem.itemCode);
        return {
          supplierUserCode: q.supplierUserCode,
          supplierName: q.supplierName,
          rate: itemInQuote ? itemInQuote.rate : null,
          amount: itemInQuote ? itemInQuote.amount : null,
          taxPercent: itemInQuote ? itemInQuote.taxPercent : 18
        };
      }).filter(s => s.rate !== null);

      supplierRates.sort((a, b) => a.rate - b.rate);

      const ratedSupplierRates = supplierRates.map((s, idx) => ({
        ...s,
        rank: idx === 0 ? 'L1' : idx === 1 ? 'L2' : idx === 2 ? 'L3' : `L${idx + 1}`
      }));

      return {
        itemCode: rfqItem.itemCode,
        itemName: rfqItem.itemName,
        category: rfqItem.category,
        quantity: rfqItem.quantity,
        unit: rfqItem.unit,
        targetRate: rfqItem.targetRate,
        supplierRates: ratedSupplierRates,
        lowestRate: ratedSupplierRates[0] ? ratedSupplierRates[0].rate : null,
        bestSupplier: ratedSupplierRates[0] ? ratedSupplierRates[0].supplierName : 'N/A'
      };
    });

    const supplierTotals = quotes.map((q) => ({
      supplierUserCode: q.supplierUserCode,
      supplierName: q.supplierName,
      supplierPhone: q.supplierPhone,
      subTotal: q.subTotal,
      freightCharge: q.freightCharge,
      gstTotal: q.gstTotal,
      grandTotal: q.grandTotal,
      deliveryTimelineDays: q.deliveryTimelineDays,
      validityDays: q.validityDays,
      version: q.version
    })).sort((a, b) => a.grandTotal - b.grandTotal);

    supplierTotals.forEach((s, idx) => {
      s.consolidatedRank = idx === 0 ? 'L1' : idx === 1 ? 'L2' : idx === 2 ? 'L3' : `L${idx + 1}`;
    });

    let bestItemWiseTotal = 0;
    itemMatrix.forEach(item => {
      if (item.lowestRate !== null) {
        bestItemWiseTotal += item.lowestRate * item.quantity;
      }
    });

    const consolidatedL1Total = supplierTotals[0] ? supplierTotals[0].grandTotal : rfq.grandTotalEstValue;
    const maxPotentialSavings = Math.max(0, consolidatedL1Total - bestItemWiseTotal);

    return res.json({
      success: true,
      batchCode,
      rfq,
      assignedSuppliers: supplierRfqs,
      quotesReceivedCount: quotes.length,
      itemMatrix,
      supplierTotals,
      consolidatedL1Supplier: supplierTotals[0] || null,
      bestItemWiseTotal,
      maxPotentialSavings
    });

  } catch (error) {
    console.error('Error generating tabulation matrix:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 9. POST /api/procurement/rfq/start-auction — Launch 5-Hour Reverse Auction
 */
exports.startReverseAuction = async (req, res) => {
  try {
    const { batchCode, durationHours = 5, minDecrement = 10 } = req.body;
    const rfq = await ProcurementRfq.findOne({ batchCode });

    if (!rfq) {
      return res.status(404).json({ success: false, message: 'RFQ Batch not found.' });
    }

    const quotes = await SupplierQuote.find({ rfqId: rfq._id, isLatest: true }).sort({ grandTotal: 1 });
    const startingL1Rate = quotes[0] ? quotes[0].grandTotal : rfq.grandTotalEstValue;

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);

    rfq.auctionSettings = {
      isAuctionActive: true,
      durationHours: Number(durationHours),
      minDecrement: Number(minDecrement),
      startTime,
      endTime,
      currentL1Rate: startingL1Rate,
      currentL1SupplierCode: quotes[0] ? quotes[0].supplierUserCode : ''
    };
    rfq.status = 'AUCTION_ACTIVE';
    await rfq.save();

    await RfqAuditLog.create({
      rfqId: rfq._id,
      batchCode: rfq.batchCode,
      action: 'AUCTION_STARTED',
      performedByRole: 'buyer',
      details: { durationHours, startingL1Rate }
    });

    return res.json({
      success: true,
      message: `5-Hour Reverse Auction launched for RFQ ${batchCode}!`,
      auctionSettings: rfq.auctionSettings
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 10. POST /api/procurement/rfq/submit-bid — Live Reverse Auction Bid
 */
exports.submitAuctionBid = async (req, res) => {
  try {
    const { batchCode, supplierUserCode, supplierName, bidAmount } = req.body;
    const rfq = await ProcurementRfq.findOne({ batchCode });

    if (!rfq || !rfq.auctionSettings.isAuctionActive) {
      return res.status(400).json({ success: false, message: 'Live auction is not currently active.' });
    }

    const now = new Date();
    if (now > new Date(rfq.auctionSettings.endTime)) {
      rfq.auctionSettings.isAuctionActive = false;
      rfq.status = 'AUCTION_ENDED';
      await rfq.save();
      return res.status(400).json({ success: false, message: 'Auction duration has expired.' });
    }

    const newBid = Number(bidAmount);
    const currentL1 = rfq.auctionSettings.currentL1Rate;
    const minDecrement = rfq.auctionSettings.minDecrement;

    if (newBid >= currentL1) {
      return res.status(400).json({
        success: false,
        message: `Your bid (₹${newBid.toLocaleString('en-IN')}) must be strictly lower than current L1 rate (₹${currentL1.toLocaleString('en-IN')}).`
      });
    }

    if ((currentL1 - newBid) < minDecrement) {
      return res.status(400).json({
        success: false,
        message: `Minimum price decrement required is ₹${minDecrement}. Your bid must be ₹${(currentL1 - minDecrement).toLocaleString('en-IN')} or lower.`
      });
    }

    const roundCount = await ReverseAuctionBid.countDocuments({ rfqId: rfq._id, supplierUserCode });

    const bidRecord = new ReverseAuctionBid({
      rfqId: rfq._id,
      batchCode: rfq.batchCode,
      supplierUserCode,
      supplierName: supplierName || 'Verified Supplier',
      roundNumber: roundCount + 1,
      bidAmount: newBid,
      previousBidAmount: currentL1,
      decrementAmount: currentL1 - newBid,
      maskedRivalName: `Rival ${String.fromCharCode(65 + Math.floor(Math.random() * 6))}`
    });

    await bidRecord.save();

    rfq.auctionSettings.currentL1Rate = newBid;
    rfq.auctionSettings.currentL1SupplierCode = supplierUserCode;
    await rfq.save();

    await RfqAuditLog.create({
      rfqId: rfq._id,
      batchCode: rfq.batchCode,
      action: 'BID_PLACED',
      performedByRole: 'supplier',
      performedByUserCode: supplierUserCode,
      details: { newBid, round: roundCount + 1 }
    });

    return res.json({
      success: true,
      message: `🎉 Downward Bid Accepted! New L1 Rate: ₹${newBid.toLocaleString('en-IN')}`,
      newL1Rate: newBid,
      round: roundCount + 1
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 11. GET /api/procurement/rfq/download-po/:batchCode — Download Comparative PO PDF
 */
exports.generatePoPdf = async (req, res) => {
  try {
    const { batchCode } = req.params;
    const rfq = await ProcurementRfq.findOne({ batchCode }).lean();

    if (!rfq) {
      return res.status(404).json({ success: false, message: 'RFQ Batch not found.' });
    }

    const quotes = await SupplierQuote.find({ rfqId: rfq._id, isLatest: true }).sort({ grandTotal: 1 }).lean();
    const winnerQuote = quotes[0] || {};

    const winnerSupplier = getRegisteredSupplier(winnerQuote.supplierName || winnerQuote.supplierUserCode || 'Jai Hanuman');

    const poNumber = `BM-PO-${batchCode.replace(/[^0-9]/g, '').slice(-6) || Math.floor(100000 + Math.random() * 900000)}`;
    const poDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=BuildMitra_PO_${batchCode}.pdf`);
    doc.pipe(res);

    // Build line items mapping with rates and tax details
    const items = rfq.items.map((item) => {
      const matchInQuote = winnerQuote.lineItems ? winnerQuote.lineItems.find(l => l.itemName.toLowerCase() === item.itemName.toLowerCase()) : null;
      const rate = matchInQuote ? Number(matchInQuote.rate) : Number(item.targetRate);
      const isCement = item.category ? item.category.toUpperCase().includes('CEMENT') : item.itemName.toUpperCase().includes('CEMENT');
      const gstPercent = isCement ? 28 : 18;
      const gstAmt = Number(((rate * gstPercent) / 100).toFixed(2));
      const freight = 15;
      const hamali = 10;
      const landed = Number((rate + gstAmt + freight + hamali).toFixed(2));

      return {
        itemName: item.itemName,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        basicRate: rate,
        gstPercent: gstPercent,
        freight: freight,
        hamali: hamali,
        landedRate: landed,
        totalValue: Number((landed * item.quantity).toFixed(2))
      };
    });

    buildProfessionalPoPdf(doc, {
      poNumber,
      poDate,
      rfqBatchCode: batchCode,
      buyer: {
        name: rfq.buyerName,
        phone: rfq.buyerPhone,
        email: rfq.buyerEmail,
        gstNo: '29AAGCB1234F1Z1'
      },
      supplier: {
        name: winnerQuote.supplierName || winnerSupplier.companyName,
        companyName: winnerSupplier.companyName,
        phone: winnerQuote.supplierPhone || winnerSupplier.phone,
        gstNo: winnerSupplier.verifiedGst,
        address: winnerSupplier.address,
        maskedCodeName: winnerQuote.maskedCodeName || 'Supplier-Alpha-12'
      },
      items,
      siteAddress: rfq.deliverySite.address,
      sitePincode: rfq.deliverySite.pincode,
      deliveryDeadline: rfq.deliverySite.requiredDate || 'Tomorrow by 11:00 AM',
      paymentTerms: rfq.deliverySite.paymentTerms || 'COD on Unloading'
    });

    doc.end();
  } catch (error) {
    console.error('Error generating PO PDF:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
