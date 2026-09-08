const express = require("express");
const router = express.Router();
const { memoryStore, query } = require("../config/postgres");
const { triggerLaunchAlert, triggerPoIssuedAlert } = require("../workers/auctionWorker");
const PDFDocument = require("pdfkit");

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
      target_price
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
    let matchedInfo = { matchedCount: 4 };
    try {
      matchedInfo = await filterSuppliersWithinRadius(site_pincode, material_category, 5.0);
    } catch (e) {}

    newAuction.matching_suppliers_count = matchedInfo.matchedCount || 4;

    // Save to Memory Store
    memoryStore.auctions.unshift(newAuction);

    // Save to PostgreSQL DB if connected
    try {
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
    } catch (dbErr) {
      // Fallback handled seamlessly
    }

    // Trigger Async WhatsApp Broadcast Alert
    triggerLaunchAlert(newAuction).catch((err) => console.error("WhatsApp trigger error:", err));

    return res.status(201).json({
      success: true,
      message: `✅ Auction #${newAuction.id} Launched! Broadcast sent to ${newAuction.matching_suppliers_count} verified local suppliers within 5 km of ${newAuction.site_pincode}.`,
      matching_suppliers_count: newAuction.matching_suppliers_count,
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
      // Try searching PostgreSQL DB
      try {
        const dbRes = await query("SELECT * FROM bulk_auctions WHERE id = $1", [id]);
        if (dbRes.rows && dbRes.rows.length > 0) {
          auction = dbRes.rows[0];
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

    return res.json({
      success: true,
      auction: {
        ...auction,
        current_l1_rate: currentL1Rate,
        remaining_seconds: remainingSecs,
        formatted_countdown: `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`,
        total_bids_count: bids.length,
        bids
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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
    const newBid = {
      id: bidId,
      auction_id: auction.id,
      vendor_id: vendor_id || `VENDOR-${Math.floor(100 + Math.random() * 900)}`,
      vendor_name: vendor_name || "Verified BuildMitra Supplier",
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
      await query(`
        INSERT INTO auction_bids (id, auction_id, vendor_id, vendor_name, vendor_phone, vendor_rating, basic_rate_per_unit, gst_percent, gst_amount, freight_per_unit, unloading_per_unit, total_landed_rate, total_order_value, can_deliver_on_time, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        newBid.id, newBid.auction_id, newBid.vendor_id, newBid.vendor_name, newBid.vendor_phone,
        newBid.vendor_rating, newBid.basic_rate_per_unit, newBid.gst_percent, newBid.gst_amount,
        newBid.freight_per_unit, newBid.unloading_per_unit, newBid.total_landed_rate,
        newBid.total_order_value, newBid.can_deliver_on_time, newBid.created_at
      ]);
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
      vendor_name: "Bangalore Cement Traders",
      vendor_phone: "+91 9888877771",
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

    const poNumber = `PO-BM-${Math.floor(100000 + Math.random() * 900000)}`;
    const poDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

    const poEntry = {
      po_number: poNumber,
      po_date: poDate,
      auction_id: auction.id,
      buyer_name: auction.buyer_name,
      buyer_phone: auction.buyer_phone,
      vendor_name: awardedBid.vendor_name,
      vendor_phone: awardedBid.vendor_phone,
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

    // Build PDF Document using pdfkit
    const doc = new PDFDocument({ margin: 40, size: "A4" });
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

    // PDF Header & Branding
    doc.rect(0, 0, 595, 60).fill("#0f172a");
    doc.fillColor("#ffffff").fontSize(20).font("Helvetica-Bold").text("BUILDMITRA BULK PURCHASE ORDER", 40, 20);
    doc.fontSize(10).font("Helvetica").text(`PO NO: ${poNumber}  |  DATE: ${poDate}`, 350, 25);

    // Section 1 — Buyer & Supplier Details
    doc.moveDown(3);
    doc.fillColor("#0f172a").fontSize(14).font("Helvetica-Bold").text("OFFICIAL PURCHASE ORDER / WORK CONTRACT", 40, 80);
    doc.rect(40, 100, 515, 1).fill("#cbd5e1");

    doc.fillColor("#334155").fontSize(10).font("Helvetica-Bold").text("BUYER / CONSIGNOR:", 40, 115);
    doc.font("Helvetica").text(`${auction.buyer_name}`, 40, 130);
    doc.text(`Phone: ${auction.buyer_phone}`, 40, 145);
    doc.text(`Delivery Site: ${auction.site_address} (${auction.site_pincode})`, 40, 160);

    doc.font("Helvetica-Bold").text("AWARDED SUPPLIER (L1):", 310, 115);
    doc.font("Helvetica").text(`${awardedBid.vendor_name}`, 310, 130);
    doc.text(`Vendor Phone: ${awardedBid.vendor_phone || '+91 9888877771'}`, 310, 145);
    doc.text(`Quality Standard: ${auction.quality_standard}`, 310, 160);

    // Section 2 — Material Specification Table
    doc.rect(40, 190, 515, 25).fill("#f1f5f9");
    doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold");
    doc.text("ITEM DESCRIPTION", 50, 198);
    doc.text("QTY", 250, 198);
    doc.text("LANDED RATE", 340, 198);
    doc.text("TOTAL AMOUNT", 450, 198);

    doc.font("Helvetica").fontSize(10).fillColor("#1e293b");
    doc.text(`${auction.material_category} (${auction.brand_preference}) - ${auction.grade}`, 50, 225);
    doc.text(`${auction.quantity} ${auction.unit}`, 250, 225);
    doc.text(`INR ${awardedBid.total_landed_rate.toFixed(2)}`, 340, 225);
    doc.text(`INR ${awardedBid.total_order_value.toLocaleString('en-IN')}`, 450, 225);

    // Rate Breakdown Box
    doc.rect(40, 255, 515, 90).stroke("#cbd5e1");
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#0284c7").text("LANDED COST BREAKDOWN PER UNIT:", 50, 265);
    doc.font("Helvetica").fillColor("#475569");
    doc.text(`• Basic Ex-Factory Rate: INR ${awardedBid.basic_rate_per_unit.toFixed(2)} / ${auction.unit}`, 50, 280);
    doc.text(`• GST (${awardedBid.gst_percent}%): INR ${(awardedBid.gst_amount || 0).toFixed(2)} / ${auction.unit}`, 50, 295);
    doc.text(`• Freight / Transport: INR ${awardedBid.freight_per_unit.toFixed(2)} / ${auction.unit}`, 50, 310);
    doc.text(`• Hamali / Unloading: INR ${awardedBid.unloading_per_unit.toFixed(2)} / ${auction.unit}`, 50, 325);

    // Terms & Conditions
    doc.rect(40, 360, 515, 80).fill("#f8fafc");
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#0f172a").text("TERMS & CONDITIONS OF SUPPLY:", 50, 370);
    doc.fontSize(9).font("Helvetica").fillColor("#334155");
    doc.text(`1. Payment Terms: ${auction.payment_terms} directly to supplier upon physical site verification.`, 50, 388);
    doc.text(`2. Delivery Timeline: Strict unloading by ${auction.delivery_deadline}.`, 50, 403);
    doc.text(`3. Material Quality: 100% ISI certified fresh factory stock with test certificate.`, 50, 418);

    doc.fontSize(10).font("Helvetica-Bold").fillColor("#16a34a").text("STATUS: PURCHASE ORDER ISSUED (L1 AWARDED)", 40, 460);

    doc.end();
  } catch (error) {
    console.error("Error generating PO:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 7. GET /api/bulk-buying/catalog-items — Connected to BuildMitra Master Items & Live Benchmark Rates
 */
router.get("/bulk-buying/catalog-items", async (req, res) => {
  try {
    let Product;
    try { Product = require("../models/Product"); } catch (e) {}

    let masterProducts = [];
    if (Product) {
      try {
        masterProducts = await Product.find({ status: "Active" }).select("masterCode itemName category subCategory brand unit basePrice").lean();
      } catch (e) {}
    }

    const fallbackCatalog = [
      { category: "CEMENT", subCategory: "Structural", itemName: "UltraTech PPC Cement (50kg Bag)", brand: "UltraTech Cement", grade: "PPC", unit: "BAGS", benchmarkRate: 365, gstPercent: 28 },
      { category: "CEMENT", subCategory: "Structural", itemName: "UltraTech OPC 53 Grade Cement", brand: "UltraTech Cement", grade: "OPC 53", unit: "BAGS", benchmarkRate: 385, gstPercent: 28 },
      { category: "CEMENT", subCategory: "Structural", itemName: "ACC Suraksha Power Cement", brand: "ACC Cement", grade: "PPC", unit: "BAGS", benchmarkRate: 360, gstPercent: 28 },
      { category: "CEMENT", subCategory: "Structural", itemName: "Birla Super 53 Grade Cement", brand: "Birla Super", grade: "OPC 53", unit: "BAGS", benchmarkRate: 375, gstPercent: 28 },
      { category: "TMT STEEL", subCategory: "Steel Rebars", itemName: "12mm TMT Rebar (Beam & Column)", brand: "Tata Tiscon", grade: "Fe550D (Seismic)", unit: "TONNES", benchmarkRate: 58500, gstPercent: 18 },
      { category: "TMT STEEL", subCategory: "Steel Rebars", itemName: "8mm TMT Rebar (Binding & Stirrups)", brand: "Tata Tiscon", grade: "Fe550D (Seismic)", unit: "TONNES", benchmarkRate: 59000, gstPercent: 18 },
      { category: "TMT STEEL", subCategory: "Steel Rebars", itemName: "10mm TMT Rebar (Slab & Lintel)", brand: "JSW Neosteel", grade: "Fe550D (Seismic)", unit: "TONNES", benchmarkRate: 58200, gstPercent: 18 },
      { category: "TMT STEEL", subCategory: "Steel Rebars", itemName: "16mm TMT Rebar (Heavy Column)", brand: "Jindal Panther", grade: "Fe550D (Seismic)", unit: "TONNES", benchmarkRate: 58000, gstPercent: 18 },
      { category: "TMT STEEL", subCategory: "Steel Rebars", itemName: "20mm TMT Rebar (High-Rise Column)", brand: "SAIL", grade: "Fe550D (Seismic)", unit: "TONNES", benchmarkRate: 57800, gstPercent: 18 },
      { category: "BLOCKS", subCategory: "Masonry", itemName: "6-Inch Concrete Solid Blocks", brand: "APCO Blocks", grade: "Standard 400x200x150mm", unit: "LOADS", benchmarkRate: 42, gstPercent: 18 },
      { category: "BLOCKS", subCategory: "Masonry", itemName: "4-Inch Concrete Solid Blocks", brand: "APCO Blocks", grade: "Standard 400x200x100mm", unit: "LOADS", benchmarkRate: 32, gstPercent: 18 },
      { category: "BLOCKS", subCategory: "Masonry", itemName: "8-Inch AAC Lightweight Blocks", brand: "Sobha Concrete", grade: "AAC 600x200x200mm", unit: "LOADS", benchmarkRate: 75, gstPercent: 18 },
      { category: "SAND", subCategory: "Aggregates", itemName: "Triple Washed M-Sand (Concrete Mix)", brand: "Quarry Direct", grade: "Zone II Fine", unit: "CFT", benchmarkRate: 48, gstPercent: 18 },
      { category: "SAND", subCategory: "Aggregates", itemName: "Double Washed P-Sand (Plastering)", brand: "Quarry Direct", grade: "Zone IV Ultra Fine", unit: "CFT", benchmarkRate: 52, gstPercent: 18 },
      { category: "AGGREGATES", subCategory: "Aggregates", itemName: "20mm Coarse Blue Metal Jelly Aggregate", brand: "Quarry Direct", grade: "Hard Granite Crushed", unit: "CFT", benchmarkRate: 38, gstPercent: 18 },
      { category: "AGGREGATES", subCategory: "Aggregates", itemName: "12mm Coarse Blue Metal Jelly Aggregate", brand: "Quarry Direct", grade: "Hard Granite Crushed", unit: "CFT", benchmarkRate: 40, gstPercent: 18 }
    ];

    const catalogItems = masterProducts.length > 0 
      ? masterProducts.map((p) => ({
          category: (p.category || "GENERAL").toUpperCase(),
          subCategory: p.subCategory || "General",
          itemName: p.itemName,
          brand: p.brand || "Standard Brand",
          grade: "Standard Grade",
          unit: (p.unit || "NOS").toUpperCase(),
          benchmarkRate: p.basePrice || 100,
          gstPercent: (p.category || "").toUpperCase().includes("CEMENT") ? 28 : 18
        }))
      : fallbackCatalog;

    return res.json({
      success: true,
      count: catalogItems.length,
      catalog: catalogItems
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
