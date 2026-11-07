const express = require("express");
const router = express.Router();
const { memoryStore, query, isPgConnected } = require("../config/postgres");
const { triggerLaunchAlert, triggerPoIssuedAlert, getSentNotificationsLog } = require("../workers/auctionWorker");
const { filterSuppliersWithinRadius, generateMaskedCodeName } = require("../services/geoFenceService");
const { buildProfessionalPoPdf } = require("../services/poPdfService");
const PDFDocument = require("pdfkit");

/**
 * 0. GET /api/suppliers/nearby — Geofenced 25km-50km radius supplier discovery
 */
router.get("/suppliers/nearby", async (req, res) => {
  try {
    const { pincode, category, categories, radius, auctionId } = req.query;
    const maxRadius = radius ? parseFloat(radius) : 25.0;
    const targetCats = categories || category || "CEMENT";
    const result = await filterSuppliersWithinRadius(pincode || "560078", targetCats, maxRadius, auctionId || "");
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * 1. POST /api/auctions — Create Bulk Auction Entry (5-Hour Countdown)
 */
router.post("/auctions", async (req, res) => {
  try {
    const {
      material_category,
      brand_preference,
      grade,
      quantity,
      unit,
      site_address,
      site_pincode,
      delivery_deadline,
      payment_terms,
      quality_standard,
      buyer_id,
      buyer_name,
      buyer_phone,
      target_price,
      selected_suppliers,
      selected_supplier_ids,
      items
    } = req.body;

    if (!material_category || !quantity || !site_address || !site_pincode) {
      return res.status(400).json({
        success: false,
        message: "Material category, quantity, site address, and pincode are required."
      });
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + 5 * 60 * 60 * 1000); // 5 Hours Countdown Window
    const auctionId = `BM-AUC-${Math.floor(1000 + Math.random() * 9000)}`;

    const newAuction = {
      id: auctionId,
      material_category: material_category.toUpperCase(),
      brand_preference: brand_preference || "UltraTech / ACC / Birla / Tata Tiscon",
      grade: grade || "Standard Grade",
      quantity: Number(quantity),
      unit: (unit || "BAGS").toUpperCase(),
      site_address,
      site_pincode,
      delivery_deadline: delivery_deadline || "Tomorrow by 11:00 AM",
      gst_percent: material_category.toUpperCase().includes("CEMENT") ? 28 : 18,
      payment_terms: payment_terms || "COD on Unloading",
      quality_standard: quality_standard || "ISI fresh stock",
      status: "ACTIVE",
      created_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      current_l1_rate: target_price ? Number(target_price) : 345.00,
      buyer_id: buyer_id || "BUYER-DEFAULT",
      buyer_name: buyer_name || "BuildMitra Verified Buyer",
      buyer_phone: buyer_phone || "+91 9876543210",
      ten_min_warning_sent: false
    };

    const { filterSuppliersWithinRadius } = require("../services/geoFenceService");
    let matchedSuppliersList = [];

    if (Array.isArray(selected_suppliers) && selected_suppliers.length > 0) {
      matchedSuppliersList = selected_suppliers;
    } else {
      try {
        const matchedInfo = await filterSuppliersWithinRadius(site_pincode, material_category, 25.0, auctionId);
        if (matchedInfo && matchedInfo.suppliers && matchedInfo.suppliers.length > 0) {
          if (Array.isArray(selected_supplier_ids) && selected_supplier_ids.length > 0) {
            matchedSuppliersList = matchedInfo.suppliers.filter(s => selected_supplier_ids.includes(s.id) || selected_supplier_ids.includes(s.userCode));
          } else {
            matchedSuppliersList = matchedInfo.suppliers;
          }
        }
      } catch (e) {}
    }

    if (matchedSuppliersList.length === 0) {
      matchedSuppliersList = [
        { id: "SUPP-JAI-HANUMAN", companyName: "Jai Hanuman Building Materials & Supplies", phone: "+91 98450 12345", distanceKm: 2.4, maskedCodeName: "Supplier-Alpha-12", isSelected: true },
        { id: "SUPP-JAI-RAMA", companyName: "Jai Sri Rama Civil & Steel Syndicate", phone: "+91 97318 88377", distanceKm: 4.8, maskedCodeName: "Supplier-Beta-34", isSelected: true },
        { id: "SUPP-SRI-KRISHNA", companyName: "Sri Krishna Building Solutions", phone: "+91 76769 42386", distanceKm: 5.2, maskedCodeName: "Supplier-Gamma-56", isSelected: true }
      ];
    }

    newAuction.matching_suppliers_count = matchedSuppliersList.length;
    newAuction.matched_suppliers = matchedSuppliersList;
    newAuction.notified_suppliers = matchedSuppliersList;
    newAuction.items = Array.isArray(items) && items.length > 0 ? items : undefined;

    // Save to Memory Store
    memoryStore.auctions.unshift(newAuction);

    // Save to PostgreSQL DB if connected
    try {
      if (isPgConnected && isPgConnected()) {
        await query(`
          INSERT INTO bulk_auctions (id, material_category, brand_preference, grade, quantity, unit, site_address, site_pincode, delivery_deadline, gst_percent, payment_terms, quality_standard, status, created_at, ends_at, current_l1_rate, buyer_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        `, [
          newAuction.id, newAuction.material_category, newAuction.brand_preference, newAuction.grade,
          newAuction.quantity, newAuction.unit, newAuction.site_address, newAuction.site_pincode,
          newAuction.delivery_deadline, newAuction.gst_percent, newAuction.payment_terms,
          newAuction.quality_standard, newAuction.status, newAuction.created_at, newAuction.ends_at,
          newAuction.current_l1_rate, newAuction.buyer_id
        ]);
      }
    } catch (dbErr) {
      // Fallback handled seamlessly
    }

    // Trigger Async WhatsApp Broadcast Alert
    triggerLaunchAlert(newAuction).catch((err) => console.error("WhatsApp trigger error:", err));

    return res.status(201).json({
      success: true,
      message: `✅ Auction #${newAuction.id} Launched! Broadcast sent to ${newAuction.matching_suppliers_count} verified local suppliers within 25-50 km radius of PIN ${newAuction.site_pincode}.`,
      matching_suppliers_count: newAuction.matching_suppliers_count,
      matched_suppliers: newAuction.matched_suppliers,
      auction: newAuction
    });
  } catch (error) {
    console.error("Error launching bulk auction:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 2. GET /api/auctions — Fetch All Auctions
 */
router.get("/auctions", async (req, res) => {
  try {
    const auctions = memoryStore.auctions.map((auc) => {
      const now = new Date();
      const endsAt = new Date(auc.ends_at);
      const remainingSecs = Math.max(0, Math.floor((endsAt.getTime() - now.getTime()) / 1000));
      const hours = Math.floor(remainingSecs / 3600);
      const minutes = Math.floor((remainingSecs % 3600) / 60);

      const bids = memoryStore.bids.filter((b) => b.auction_id === auc.id);
      
      return {
        ...auc,
        remaining_seconds: remainingSecs,
        formatted_countdown: `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`,
        total_bids_count: bids.length
      };
    });

    return res.json({ success: true, count: auctions.length, auctions });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 3. GET /api/auctions/:id — Fetch Single Auction & Live L1 Rate
 */
router.get("/auctions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let auction = memoryStore.auctions.find((a) => a.id === id || a.id.toLowerCase() === id.toLowerCase());

    if (!auction) {
      // Try searching PostgreSQL DB if connected
      try {
        if (isPgConnected && isPgConnected()) {
          const dbRes = await query("SELECT * FROM bulk_auctions WHERE id = $1", [id]);
          if (dbRes.rows && dbRes.rows.length > 0) {
            auction = dbRes.rows[0];
          }
        }
      } catch (err) {}
    }

    if (!auction) {
      // Fallback to first available auction or default mock
      auction = memoryStore.auctions[0];
    }

    const now = new Date();
    const endsAt = new Date(auction.ends_at);
    const remainingSecs = Math.max(0, Math.floor((endsAt.getTime() - now.getTime()) / 1000));
    const hours = Math.floor(remainingSecs / 3600);
    const minutes = Math.floor((remainingSecs % 3600) / 60);

    const bids = memoryStore.bids.filter((b) => b.auction_id === auction.id);
    bids.sort((a, b) => a.total_landed_rate - b.total_landed_rate);

    const l1Bid = bids[0];
    const currentL1Rate = l1Bid ? l1Bid.total_landed_rate : auction.current_l1_rate;

    const diffMinutes = Math.floor(remainingSecs / 60);
    const isTenMinWarningActive = Boolean(auction.is_ten_min_warning_active || (diffMinutes > 0 && diffMinutes <= 10));

    // Handle Commercial Anti-Collusion Masking:
    // If supplier view or explicitly requested masked, mask real vendor names
    const isBuyerOrAdmin = req.query.role === "buyer" || req.query.role === "admin" || auction.status === "AWARDED";
    const processedBids = bids.map((b, idx) => {
      const maskedCode = b.masked_code_name || generateMaskedCodeName(b.vendor_id || b.vendor_name, auction.id);
      return {
        ...b,
        rank: `L${idx + 1}`,
        is_l1: idx === 0,
        masked_code_name: maskedCode,
        display_name: isBuyerOrAdmin ? b.vendor_name : maskedCode,
        display_phone: isBuyerOrAdmin ? b.vendor_phone : "Confidential Supplier",
        vendor_name: isBuyerOrAdmin ? b.vendor_name : maskedCode
      };
    });

    return res.json({
      success: true,
      auction: {
        ...auction,
        current_l1_rate: currentL1Rate,
        remaining_seconds: remainingSecs,
        formatted_countdown: `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`,
        total_bids_count: bids.length,
        is_ten_min_warning_active: isTenMinWarningActive,
        bids: processedBids
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 3b. GET /api/auctions/:id/notifications — Fetch Live Worker WhatsApp Logs
 */
router.get("/auctions/:id/notifications", (req, res) => {
  try {
    const { id } = req.params;
    const logs = getSentNotificationsLog(id);
    return res.json({ success: true, count: logs.length, notifications: logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * 4. POST /api/bids — Submit Landed Quotation (Supplier Bidding)
 */
router.post("/bids", async (req, res) => {
  try {
    const {
      auction_id,
      vendor_id,
      vendor_name,
      vendor_phone,
      vendor_rating,
      basic_rate_per_unit,
      gst_percent,
      freight_per_unit,
      unloading_per_unit,
      can_deliver_on_time
    } = req.body;

    if (!auction_id || !basic_rate_per_unit) {
      return res.status(400).json({
        success: false,
        message: "Auction ID and Basic Rate per unit are required."
      });
    }

    const auction = memoryStore.auctions.find((a) => a.id === auction_id || a.id.toLowerCase() === auction_id.toLowerCase()) || memoryStore.auctions[0];

    const now = new Date();
    const endsAt = new Date(auction.ends_at);

    if (auction.status !== "ACTIVE" || now > endsAt) {
      return res.status(400).json({
        success: false,
        message: "This auction is closed or evaluating. No further quotes accepted."
      });
    }

    const numericBasic = parseFloat(basic_rate_per_unit);
    const numericGst = parseFloat(gst_percent || auction.gst_percent || 28);
    const numericFreight = parseFloat(freight_per_unit || 0);
    const numericUnloading = parseFloat(unloading_per_unit || 0);

    const gstAmount = Number(((numericBasic * numericGst) / 100).toFixed(2));
    const landedPerUnit = Number((numericBasic + gstAmount + numericFreight + numericUnloading).toFixed(2));
    const totalOrderValue = Number((landedPerUnit * auction.quantity).toFixed(2));

    const bidId = `BID-${Math.floor(1000 + Math.random() * 9000)}`;
    const effectiveVendorId = vendor_id || `VENDOR-${Math.floor(100 + Math.random() * 900)}`;
    const maskedCode = generateMaskedCodeName(effectiveVendorId, auction.id);

    const newBid = {
      id: bidId,
      auction_id: auction.id,
      vendor_id: effectiveVendorId,
      vendor_name: vendor_name || "Verified BuildMitra Supplier",
      masked_code_name: maskedCode,
      vendor_phone: vendor_phone || "+91 9888877777",
      vendor_rating: vendor_rating || 4.8,
      basic_rate_per_unit: numericBasic,
      gst_percent: numericGst,
      gst_amount: gstAmount,
      freight_per_unit: numericFreight,
      unloading_per_unit: numericUnloading,
      total_landed_rate: landedPerUnit,
      total_order_value: totalOrderValue,
      can_deliver_on_time: can_deliver_on_time !== undefined ? Boolean(can_deliver_on_time) : true,
      created_at: now.toISOString()
    };

    // Store in memory store
    memoryStore.bids.push(newBid);

    // Update auction current L1 rate if this bid is lower
    if (!auction.current_l1_rate || landedPerUnit < auction.current_l1_rate) {
      auction.current_l1_rate = landedPerUnit;
    }

    // Save to PostgreSQL if connected
    try {
      if (isPgConnected && isPgConnected()) {
        await query(`
          INSERT INTO auction_bids (id, auction_id, vendor_id, vendor_name, vendor_phone, vendor_rating, basic_rate_per_unit, gst_percent, gst_amount, freight_per_unit, unloading_per_unit, total_landed_rate, total_order_value, can_deliver_on_time, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `, [
          newBid.id, newBid.auction_id, newBid.vendor_id, newBid.vendor_name, newBid.vendor_phone,
          newBid.vendor_rating, newBid.basic_rate_per_unit, newBid.gst_percent, newBid.gst_amount,
          newBid.freight_per_unit, newBid.unloading_per_unit, newBid.total_landed_rate,
          newBid.total_order_value, newBid.can_deliver_on_time, newBid.created_at
        ]);
      }
    } catch (dbErr) {}

    // Calculate dynamic rank for this vendor
    const auctionBids = memoryStore.bids.filter((b) => b.auction_id === auction.id);
    auctionBids.sort((a, b) => a.total_landed_rate - b.total_landed_rate);

    const rankIndex = auctionBids.findIndex((b) => b.id === newBid.id);
    const rank = `L${rankIndex + 1}`;
    const isL1 = rank === "L1";

    return res.status(201).json({
      success: true,
      message: isL1 ? "Congratulations! Your quote is currently the winning L1 price!" : "Landed quotation submitted successfully.",
      rank,
      isL1,
      total_landed_rate: landedPerUnit,
      total_order_value: totalOrderValue,
      bid: newBid
    });
  } catch (error) {
    console.error("Error submitting bid:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 5. GET /api/auctions/:id/comparative-statement — Query Comparative Sheet Matrix
 */
router.get("/auctions/:id/comparative-statement", async (req, res) => {
  try {
    const { id } = req.params;
    let auction = memoryStore.auctions.find((a) => a.id === id || a.id.toLowerCase() === id.toLowerCase()) || memoryStore.auctions[0];

    const auctionBids = memoryStore.bids.filter((b) => b.auction_id === auction.id);
    auctionBids.sort((a, b) => a.total_landed_rate - b.total_landed_rate);

    const comparativeMatrix = auctionBids.map((bid, index) => {
      const rankLabel = `L${index + 1}`;
      return {
        rank: rankLabel,
        is_l1: index === 0,
        bid_id: bid.id,
        vendor_id: bid.vendor_id,
        vendor_name: bid.vendor_name,
        vendor_rating: bid.vendor_rating,
        basic_rate_per_unit: bid.basic_rate_per_unit,
        gst_percent: bid.gst_percent,
        gst_amount: bid.gst_amount,
        freight_per_unit: bid.freight_per_unit,
        unloading_per_unit: bid.unloading_per_unit,
        total_landed_rate: bid.total_landed_rate,
        total_order_value: bid.total_order_value,
        can_deliver_on_time: bid.can_deliver_on_time,
        created_at: bid.created_at
      };
    });

    return res.json({
      success: true,
      auction,
      total_bids: comparativeMatrix.length,
      l1_landed_rate: comparativeMatrix[0]?.total_landed_rate || auction.current_l1_rate,
      comparative_statement: comparativeMatrix
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 6. POST /api/po/generate — Award Bid & Generate Purchase Order PDF
 */
router.post("/po/generate", async (req, res) => {
  try {
    const { auction_id, bid_id, buyer_notes } = req.body;

    const auction = memoryStore.auctions.find((a) => a.id === auction_id || a.id.toLowerCase() === auction_id.toLowerCase()) || memoryStore.auctions[0];
    const bids = memoryStore.bids.filter((b) => b.auction_id === auction.id);
    bids.sort((a, b) => a.total_landed_rate - b.total_landed_rate);

    const awardedBid = bids.find((b) => b.id === bid_id) || bids[0] || {
      id: "BID-901",
      vendor_name: "Jai Hanuman Building Materials & Supplies",
      vendor_phone: "+91 98450 12345",
      masked_code_name: "Supplier-Alpha-12",
      basic_rate_per_unit: 250,
      gst_percent: 28,
      gst_amount: 70,
      freight_per_unit: 15,
      unloading_per_unit: 10,
      total_landed_rate: 345,
      total_order_value: 69000
    };

    auction.status = "AWARDED";
    auction.awarded_bid_id = awardedBid.id;
    auction.awarded_vendor_name = awardedBid.vendor_name;

    const poNumber = `BM-PO-${Math.floor(100000 + Math.random() * 900000)}`;
    const poDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

    const poEntry = {
      po_number: poNumber,
      po_date: poDate,
      auction_id: auction.id,
      buyer_name: auction.buyer_name,
      buyer_phone: auction.buyer_phone,
      vendor_name: awardedBid.vendor_name,
      vendor_phone: awardedBid.vendor_phone,
      masked_code_name: awardedBid.masked_code_name || "Supplier-Alpha-12",
      material_category: auction.material_category,
      brand_preference: auction.brand_preference,
      quantity: auction.quantity,
      unit: auction.unit,
      landed_rate_per_unit: awardedBid.total_landed_rate,
      total_order_value: awardedBid.total_order_value,
      site_address: auction.site_address,
      site_pincode: auction.site_pincode,
      payment_terms: auction.payment_terms,
      delivery_deadline: auction.delivery_deadline,
      created_at: new Date().toISOString()
    };

    memoryStore.purchaseOrders.push(poEntry);

    // Trigger WhatsApp Dispatch to Awarded Supplier
    triggerPoIssuedAlert(poEntry).catch((err) => console.error("WhatsApp PO dispatch error:", err));

    // Build Professional Non-Overwritten PDF Document using pdfkit & poPdfService
    const doc = new PDFDocument({ margin: 36, size: "A4" });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      const pdfBase64 = pdfBuffer.toString("base64");

      return res.json({
        success: true,
        message: "Purchase Order issued and generated successfully!",
        po_number: poNumber,
        po_details: poEntry,
        pdf_base64: pdfBase64
      });
    });

    // Render Professional Corporate PO Document
    buildProfessionalPoPdf(doc, {
      poNumber: poNumber,
      poDate: poDate,
      rfqBatchCode: auction.id,
      buyer: {
        name: auction.buyer_name,
        phone: auction.buyer_phone,
        email: "procurement@buildmitra.com"
      },
      supplier: {
        name: awardedBid.vendor_name,
        phone: awardedBid.vendor_phone,
        maskedCodeName: awardedBid.masked_code_name
      },
      items: auction.items && auction.items.length > 0 ? auction.items : [
        {
          itemName: auction.specific_item || `${auction.material_category} (${auction.brand_preference || 'Standard'})`,
          category: auction.material_category,
          brand: auction.brand_preference,
          grade: auction.grade,
          quantity: auction.quantity,
          unit: auction.unit,
          basicRate: awardedBid.basic_rate_per_unit,
          gstPercent: awardedBid.gst_percent,
          freight: awardedBid.freight_per_unit,
          hamali: awardedBid.unloading_per_unit,
          landedRate: awardedBid.total_landed_rate,
          totalValue: awardedBid.total_order_value
        }
      ],
      siteAddress: auction.site_address,
      sitePincode: auction.site_pincode,
      paymentTerms: auction.payment_terms || "COD on Unloading",
      deliveryDeadline: auction.delivery_deadline || "Tomorrow by 11:00 AM",
      qualityStandard: auction.quality_standard || "100% Fresh ISI Factory Stock with MTC",
      awardedBid
    });

    doc.end();
  } catch (error) {
    console.error("Error generating PO:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 7. GET /api/bulk-buying/catalog-items — Connected to BuildMitra Admin Master Items & Live Market Rates
 */
router.get("/bulk-buying/catalog-items", async (req, res) => {
  try {
    const { category, subCategory, search } = req.query;

    let MasterItem;
    let MarketRate;
    let MasterMaterial;
    try { MasterItem = require("../models/MasterItem"); } catch (e) {}
    try { MarketRate = require("../models/MarketRate"); } catch (e) {}
    try { MasterMaterial = require("../models/MasterMaterial"); } catch (e) {}

    let items = [];
    let rateMap = new Map();

    if (MasterItem) {
      try {
        const filter = { status: "active" };
        if (category) filter.category = new RegExp(category, "i");
        if (subCategory) filter.subCategory = new RegExp(subCategory, "i");
        if (search) {
          filter.$or = [
            { itemName: new RegExp(search, "i") },
            { brand: new RegExp(search, "i") },
            { specification: new RegExp(search, "i") },
            { masterItemCode: new RegExp(search, "i") }
          ];
        }

        const [dbItems, dbRates] = await Promise.all([
          MasterItem.find(filter).sort({ category: 1, itemName: 1 }).lean().exec(),
          MarketRate ? MarketRate.find({ approvalStatus: "approved", isActive: true }).lean().exec() : Promise.resolve([])
        ]);

        if (Array.isArray(dbRates)) {
          dbRates.forEach((r) => {
            if (r.masterItemCode) rateMap.set(r.masterItemCode, r.currentRate);
            if (r.itemCode) rateMap.set(r.itemCode, r.currentRate);
          });
        }

        if (Array.isArray(dbItems) && dbItems.length > 0) {
          items = dbItems.map((m) => {
            const cat = (m.category || "GENERAL").toUpperCase();
            const liveRate = rateMap.get(m.masterItemCode) ?? m.referenceRate ?? 100;
            const gst = m.gst || (cat.includes("CEMENT") ? 28 : 18);
            return {
              id: m.masterItemCode || String(m._id),
              masterItemCode: m.masterItemCode || `MAT-${m._id}`,
              name: m.brand ? `${m.itemName} (${m.brand})` : m.itemName,
              itemName: m.itemName,
              category: cat,
              subCategory: m.subCategory || m.category || "General",
              brand: m.brand || "Standard Brand",
              grade: m.specification || "Standard Grade",
              specification: m.specification || "",
              unit: (m.unit || "BAGS").toUpperCase(),
              benchmarkRate: Number(liveRate),
              gstPercent: Number(gst),
              hsnCode: m.hsnCode || "",
              imageUrl: m.imageUrl || ""
            };
          });
        }
      } catch (dbErr) {
        console.warn("MasterItem DB fetch fallback:", dbErr.message);
      }
    }

    // Fallback to MasterMaterial if MasterItem yielded nothing
    if (items.length === 0 && MasterMaterial) {
      try {
        const matItems = await MasterMaterial.find({ status: { $ne: "Inactive" } }).lean().exec();
        if (Array.isArray(matItems) && matItems.length > 0) {
          items = matItems.map((m) => {
            const cat = (m.category || "GENERAL").toUpperCase();
            return {
              id: m.masterCode || m.material_code || String(m._id),
              masterItemCode: m.masterCode || m.material_code || `MAT-${m._id}`,
              name: m.brand ? `${m.product_name || m.itemName} (${m.brand})` : (m.product_name || m.itemName),
              itemName: m.product_name || m.itemName,
              category: cat,
              subCategory: m.subcategory || m.category || "General",
              brand: m.brand || "Standard Brand",
              grade: m.specification || "Standard Grade",
              specification: m.specification || "",
              unit: (m.unit || "BAGS").toUpperCase(),
              benchmarkRate: Number(m.rate || 100),
              gstPercent: Number(m.gst || (cat.includes("CEMENT") ? 28 : 18)),
              imageUrl: m.imageUrl || m.image || ""
            };
          });
        }
      } catch (matErr) {}
    }

    // Comprehensive Admin Master Default Seed Catalog (Zero-Downtime Guarantee)
    if (items.length === 0) {
      const canonicalCatalog = [
        { id: "MAT-CEM-01", masterItemCode: "MAT-CEM-01", itemName: "UltraTech PPC Cement (50kg Bag)", name: "UltraTech PPC Cement (50kg Bag)", category: "CEMENT", subCategory: "Structural Cement", brand: "UltraTech Cement", grade: "PPC (IS 1489 Part 1)", specification: "50kg HDPE Bag • Fly Ash Based", unit: "BAGS", benchmarkRate: 365, gstPercent: 28 },
        { id: "MAT-CEM-02", masterItemCode: "MAT-CEM-02", itemName: "UltraTech Super OPC 53 Grade", name: "UltraTech Super OPC 53 Grade Cement", category: "CEMENT", subCategory: "High Strength", brand: "UltraTech Cement", grade: "OPC 53 (IS 269)", specification: "50kg Bag • 28-Day Strength 53+ MPa", unit: "BAGS", benchmarkRate: 385, gstPercent: 28 },
        { id: "MAT-CEM-03", masterItemCode: "MAT-CEM-03", itemName: "ACC Suraksha Power Cement", name: "ACC Suraksha Power Cement (50kg Bag)", category: "CEMENT", subCategory: "Water-Resistant", brand: "ACC Cement", grade: "PPC Super", specification: "Water-repellent active micro-particles", unit: "BAGS", benchmarkRate: 360, gstPercent: 28 },
        { id: "MAT-CEM-04", masterItemCode: "MAT-CEM-04", itemName: "Birla Super 53 Grade Cement", name: "Birla Super 53 Grade Cement", category: "CEMENT", subCategory: "High Strength", brand: "Birla Super", grade: "OPC 53 (IS 269)", specification: "High early setting strength for slabs", unit: "BAGS", benchmarkRate: 375, gstPercent: 28 },
        { id: "MAT-STL-01", masterItemCode: "MAT-STL-01", itemName: "12mm TMT Rebar (Fe 550D)", name: "12mm TMT Rebar (Beam & Column)", category: "TMT STEEL", subCategory: "Primary Rebars", brand: "Tata Tiscon", grade: "Fe 550D Seismic (IS 1786)", specification: "High elongation ductility for earthquake zones", unit: "TONNES", benchmarkRate: 58500, gstPercent: 18 },
        { id: "MAT-STL-02", masterItemCode: "MAT-STL-02", itemName: "10mm TMT Rebar (Fe 550D)", name: "10mm TMT Rebar (Slab & Lintel)", category: "TMT STEEL", subCategory: "Primary Rebars", brand: "JSW Neosteel", grade: "Fe 550D (IS 1786)", specification: "Virgin billet rolled with corrosion protection", unit: "TONNES", benchmarkRate: 58200, gstPercent: 18 },
        { id: "MAT-STL-03", masterItemCode: "MAT-STL-03", itemName: "16mm TMT Rebar (Heavy Column)", name: "16mm TMT Rebar (Heavy Structural)", category: "TMT STEEL", subCategory: "Primary Rebars", brand: "Jindal Panther", grade: "Fe 550D (IS 1786)", specification: "High tensile yield strength 550 N/mm²", unit: "TONNES", benchmarkRate: 58000, gstPercent: 18 },
        { id: "MAT-STL-04", masterItemCode: "MAT-STL-04", itemName: "8mm TMT Rebar (Stirrups & Rings)", name: "8mm TMT Rebar (Binding & Stirrups)", category: "TMT STEEL", subCategory: "Secondary Rebars", brand: "Tata Tiscon", grade: "Fe 550D", specification: "Ring & stirrup ductile bending grade", unit: "TONNES", benchmarkRate: 59000, gstPercent: 18 },
        { id: "MAT-SND-01", masterItemCode: "MAT-SND-01", itemName: "Triple-Washed M-Sand", name: "Triple-Washed M-Sand (Zone II Concrete)", category: "SAND", subCategory: "Manufactured Sand", brand: "Quarry Direct", grade: "Zone II (IS 383)", specification: "Double hydro-cyclone washed silt < 3%", unit: "CFT", benchmarkRate: 48, gstPercent: 18 },
        { id: "MAT-SND-02", masterItemCode: "MAT-SND-02", itemName: "Double-Washed P-Sand", name: "Double-Washed P-Sand (Plastering)", category: "SAND", subCategory: "Plastering Sand", brand: "Quarry Direct", grade: "Zone IV Ultra-Fine", specification: "Sub-150 micron fine washed plaster sand", unit: "CFT", benchmarkRate: 52, gstPercent: 18 },
        { id: "MAT-AGG-01", masterItemCode: "MAT-AGG-01", itemName: "20mm Blue Metal Jelly Aggregate", name: "20mm Coarse Granite Blue Metal Jelly", category: "AGGREGATES", subCategory: "Coarse Aggregate", brand: "Quarry Direct", grade: "Hard Granite Crushed", specification: "Flakiness index < 15%, angular crushed", unit: "CFT", benchmarkRate: 38, gstPercent: 18 },
        { id: "MAT-AGG-02", masterItemCode: "MAT-AGG-02", itemName: "12mm Blue Metal Jelly Aggregate", name: "12mm Coarse Granite Blue Metal Jelly", category: "AGGREGATES", subCategory: "Coarse Aggregate", brand: "Quarry Direct", grade: "Hard Granite Crushed", specification: "Graded for slab and beam concrete mixes", unit: "CFT", benchmarkRate: 40, gstPercent: 18 },
        { id: "MAT-BLK-01", masterItemCode: "MAT-BLK-01", itemName: "6-Inch Concrete Solid Blocks", name: "6-Inch Concrete Solid Blocks (400x200x150)", category: "BLOCKS", subCategory: "Solid Masonry", brand: "APCO Blocks", grade: "Heavy Duty High-Density", specification: "Compressive strength > 5.0 N/mm²", unit: "LOADS", benchmarkRate: 42, gstPercent: 18 },
        { id: "MAT-BLK-02", masterItemCode: "MAT-BLK-02", itemName: "4-Inch Concrete Partition Blocks", name: "4-Inch Concrete Solid Blocks (400x200x100)", category: "BLOCKS", subCategory: "Partition Masonry", brand: "APCO Blocks", grade: "Standard High-Density", specification: "Light partition wall masonry units", unit: "LOADS", benchmarkRate: 32, gstPercent: 18 },
        { id: "MAT-BLK-03", masterItemCode: "MAT-BLK-03", itemName: "8-Inch AAC Lightweight Blocks", name: "8-Inch AAC Lightweight Blocks (600x200x200)", category: "BLOCKS", subCategory: "Autoclaved Aerated", brand: "Sobha Concrete", grade: "Grade 1 (IS 2185 Part 3)", specification: "Thermal insulation density 550-650 kg/m³", unit: "LOADS", benchmarkRate: 75, gstPercent: 18 },
        { id: "MAT-RMC-01", masterItemCode: "MAT-RMC-01", itemName: "M25 Grade ReadyMix Concrete (RMC)", name: "M25 ReadyMix Concrete (RMC Pump Mix)", category: "RMC", subCategory: "ReadyMix Concrete", brand: "UltraTech RMC", grade: "M25 (28-day 25 MPa)", specification: "Transit mixer pump mix with slump 120±25mm", unit: "CUM", benchmarkRate: 4200, gstPercent: 18 }
      ];

      items = canonicalCatalog;
      if (category) {
        items = items.filter(i => i.category.toLowerCase().includes(category.toLowerCase()));
      }
      if (search) {
        const s = search.toLowerCase();
        items = items.filter(i => i.name.toLowerCase().includes(s) || i.brand.toLowerCase().includes(s) || i.category.toLowerCase().includes(s));
      }
    }

    return res.json({
      success: true,
      count: items.length,
      categories: Array.from(new Set(items.map(i => i.category))).sort(),
      catalog: items,
      items
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 8. GET /api/whatsapp/webhook — Meta Webhook Verification
 */
router.get("/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "BUILDMITRA_WHATSAPP_SECRET";

  if (mode && token === VERIFY_TOKEN) {
    console.log("✅ WhatsApp webhook verified successfully!");
    return res.status(200).send(challenge);
  } else {
    return res.status(403).json({ success: false, message: "Verification token mismatch" });
  }
});

/**
 * 9. POST /api/whatsapp/webhook — 1-Tap Inbound WhatsApp Bid Submission
 */
router.post("/whatsapp/webhook", async (req, res) => {
  try {
    const body = req.body;
    let senderPhone = "";
    let messageText = "";

    // Parse Meta Cloud API / Twilio / Custom Webhook payload
    if (body.entry && body.entry[0]?.changes[0]?.value?.messages[0]) {
      const msg = body.entry[0].changes[0].value.messages[0];
      senderPhone = msg.from; // Vendor WhatsApp Phone
      messageText = msg.text?.body || msg.interactive?.button_reply?.id || "";
    } else if (body.From || body.Body) {
      senderPhone = body.From?.replace("whatsapp:", "") || "";
      messageText = body.Body || "";
    } else {
      senderPhone = body.sender_phone || body.phone || "+91 9888877771";
      messageText = body.message || body.text || "";
    }

    if (!messageText) {
      return res.status(400).json({ success: false, message: "No text payload found in webhook." });
    }

    console.log(`📱 [WHATSAPP INBOUND BID] From: ${senderPhone} | Message: "${messageText}"`);

    // Parse bid amount e.g. "BID 335" or "BID BM-AUC-410 335" or raw numeric "335"
    let extractedAuctionId = null;
    let extractedRate = null;

    const parts = messageText.trim().split(/\s+/);
    parts.forEach((p) => {
      if (p.toUpperCase().startsWith("BM-AUC-")) {
        extractedAuctionId = p.toUpperCase();
      } else if (!isNaN(parseFloat(p)) && parseFloat(p) > 0) {
        extractedRate = parseFloat(p);
      }
    });

    if (!extractedRate || extractedRate <= 0) {
      return res.status(200).json({
        success: true,
        reply: `⚠️ BuildMitra WhatsApp Helper: To submit a price quote, send: "BID [Rate]" (e.g. "BID 335").`
      });
    }

    // Find target auction (specified ID or latest active auction)
    let auction = null;
    if (extractedAuctionId) {
      auction = memoryStore.auctions.find((a) => a.id === extractedAuctionId);
    }
    if (!auction) {
      auction = memoryStore.auctions.find((a) => a.status === "ACTIVE") || memoryStore.auctions[0];
    }

    // Calculate landed cost
    const gstRate = auction.gst_percent || 28;
    const freight = 15;
    const unloading = 10;
    const gstAmount = Number(((extractedRate * gstRate) / 100).toFixed(2));
    const landedPerUnit = Number((extractedRate + gstAmount + freight + unloading).toFixed(2));
    const totalOrderValue = Number((landedPerUnit * auction.quantity).toFixed(2));

    const bidId = `BID-WA-${Math.floor(1000 + Math.random() * 9000)}`;
    const newBid = {
      id: bidId,
      auction_id: auction.id,
      vendor_id: senderPhone,
      vendor_name: `WhatsApp Supplier (${senderPhone.slice(-4)})`,
      vendor_phone: senderPhone,
      vendor_rating: 4.8,
      basic_rate_per_unit: extractedRate,
      gst_percent: gstRate,
      gst_amount: gstAmount,
      freight_per_unit: freight,
      unloading_per_unit: unloading,
      total_landed_rate: landedPerUnit,
      total_order_value: totalOrderValue,
      can_deliver_on_time: true,
      created_at: new Date().toISOString()
    };

    memoryStore.bids.push(newBid);

    if (!auction.current_l1_rate || landedPerUnit < auction.current_l1_rate) {
      auction.current_l1_rate = landedPerUnit;
    }

    // Calculate dynamic rank
    const auctionBids = memoryStore.bids.filter((b) => b.auction_id === auction.id);
    auctionBids.sort((a, b) => a.total_landed_rate - b.total_landed_rate);
    const rankIndex = auctionBids.findIndex((b) => b.id === newBid.id);
    const rank = `L${rankIndex + 1}`;
    const isL1 = rank === "L1";

    const replyMessage = isL1
      ? `🎉 WINNING QUOTE! Your rate of ₹${extractedRate} (Landed: ₹${landedPerUnit}/${auction.unit}) for Auction #${auction.id} is currently RANK L1! Total: ₹${totalOrderValue.toLocaleString('en-IN')}.`
      : `✅ Your quote of ₹${extractedRate} (Landed: ₹${landedPerUnit}/${auction.unit}) for Auction #${auction.id} has been logged. Current Rank: ${rank}. Current L1 Target: ₹${auction.current_l1_rate.toFixed(2)}. Beat L1 to win.`;

    console.log(`📱 [WHATSAPP OUTBOUND REPLY] To ${senderPhone}: "${replyMessage}"`);

    return res.status(200).json({
      success: true,
      message: replyMessage,
      rank,
      isL1,
      landed_rate: landedPerUnit,
      bid: newBid
    });
  } catch (error) {
    console.error("Error handling WhatsApp webhook:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
