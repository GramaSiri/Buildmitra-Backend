const fs = require('fs');
const path = require('path');
const { getRegisteredSupplier } = require('./geoFenceService');

/**
 * BuildMitra Professional Industry-Standard Purchase Order (PO) PDF Engine
 * Features:
 * - Official BuildMitra Header & Logo graphic asset
 * - Complete "From" (Buyer/BuildMitra) & "To" (Winning Supplier: Jai Hanuman / Jai Sri Rama / Sri Krishna) address blocks with GSTIN
 * - Non-overwritten, professional multi-column material details table (HSN/SAC, Qty, Unit, Basic Rate, GST, Freight, Hamali, Landed Rate, Total Value)
 * - Explicit Loading & Unloading Terms
 * - Commercial Payment Terms & Delivery Schedule
 * - Standard Terms & Conditions (Jurisdiction Bengaluru, 12-month Defect Liability, Liquidated Damages)
 * - Authorized Signatory block & Supplier Acceptance seal
 */

function getHsnCodeForMaterial(category, itemName) {
  const text = `${category} ${itemName}`.toUpperCase();
  if (text.includes('CEMENT')) return '252329';
  if (text.includes('STEEL') || text.includes('TMT') || text.includes('REBAR')) return '721420';
  if (text.includes('SAND')) return '250510';
  if (text.includes('AGGREGATE') || text.includes('JELLY')) return '251710';
  if (text.includes('BLOCK') || text.includes('AAC')) return '681011';
  if (text.includes('RMC') || text.includes('CONCRETE')) return '382450';
  if (text.includes('TILE')) return '690721';
  if (text.includes('PAINT')) return '320910';
  return '252300';
}

function buildProfessionalPoPdf(doc, data) {
  const {
    poNumber = `BM-PO-${Math.floor(100000 + Math.random() * 900000)}`,
    poDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    rfqBatchCode = 'BM-RFQ-2026',
    buyer = {},
    supplier = {},
    items = [],
    paymentTerms = 'COD on Unloading (Physical site inspection & weighbridge slip verification)',
    deliveryDeadline = 'Tomorrow by 11:00 AM',
    qualityStandard = '100% Fresh ISI Factory Stock with Manufacturer Test Certificate (MTC)',
    siteAddress = 'Plot 42, Green Glen Layout, Bellandur, Bengaluru',
    sitePincode = '560068',
    awardedBid = {}
  } = data;

  const resolvedSupplier = getRegisteredSupplier(supplier.name || supplier.companyName || awardedBid.vendor_name || 'Jai Hanuman');

  const supplierName = supplier.companyName || supplier.name || awardedBid.vendor_name || resolvedSupplier.companyName;
  const supplierPhone = supplier.phone || awardedBid.vendor_phone || resolvedSupplier.phone;
  const supplierGst = supplier.gstNo || supplier.verifiedGst || resolvedSupplier.verifiedGst;
  const supplierAddress = supplier.address || resolvedSupplier.address;
  const supplierMaskedCode = supplier.maskedCodeName || awardedBid.masked_code_name || 'Supplier-Alpha-12';

  const buyerName = buyer.name || buyer.buyer_name || 'BuildMitra Procurement Desk / M. Chinnappa Reddy (GM Materials)';
  const buyerPhone = buyer.phone || buyer.buyer_phone || '+91 98450 99881';
  const buyerEmail = buyer.email || 'procurement@buildmitra.com';
  const buyerGst = buyer.gstNo || '29AAGCB1234F1Z1';

  // 1. TOP HEADER & LOGO BRANDING
  const logoPath = path.join(__dirname, '../assets/buildmitra-logo.png');
  const hasLogo = fs.existsSync(logoPath);

  // Top Dark Accent Header
  doc.rect(0, 0, 595.28, 75).fill('#0f172a');

  if (hasLogo) {
    try {
      doc.image(logoPath, 36, 12, { width: 130 });
    } catch (e) {
      doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('BUILDMITRA', 36, 16);
    }
  } else {
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('BUILDMITRA', 36, 16);
  }

  // Header Title & Tagline
  doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold').text('OFFICIAL COMMERCIAL PURCHASE ORDER', 220, 16);
  doc.fillColor('#38bdf8').fontSize(8).font('Helvetica').text('B2B Digital Materials Procurement & Live Reverse Auction Engine', 220, 32);
  doc.fillColor('#cbd5e1').fontSize(7.5).font('Helvetica').text('BuildMitra Infra Tech Private Limited • CIN: U74999KA2025PTC189211 • GSTIN: ' + buyerGst, 220, 44);
  doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica').text('Outer Ring Road, Bellandur, Bengaluru, Karnataka - 560068 • Email: procurement@buildmitra.com', 220, 56);

  // PO Reference Badge on Right
  doc.rect(430, 10, 135, 55).fill('#1e293b');
  doc.rect(430, 10, 135, 55).stroke('#334155');
  doc.fillColor('#38bdf8').fontSize(7.5).font('Helvetica-Bold').text('PURCHASE ORDER REF', 438, 16);
  doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text(poNumber, 438, 27);
  doc.fillColor('#94a3b8').fontSize(7).font('Helvetica').text(`Date: ${poDate}`, 438, 41);
  doc.fillColor('#4ade80').fontSize(7).font('Helvetica-Bold').text(`Batch: ${rfqBatchCode}`, 438, 51);

  // 2. TWO-COLUMN FROM / TO ADDRESS CARDS
  let curY = 85;

  // Left Card: BUYER / CONSIGNOR
  doc.roundedRect(36, curY, 255, 96, 4).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('ISSUED BY / BUYER (CONSIGNOR / BILL TO):', 44, curY + 8);
  doc.fillColor('#1e293b').fontSize(8.5).font('Helvetica-Bold').text(buyerName, 44, curY + 22);
  doc.fillColor('#475569').fontSize(7.5).font('Helvetica').text(`GSTIN: ${buyerGst}`, 44, curY + 34);
  doc.fillColor('#475569').fontSize(7.5).font('Helvetica').text(`Contact: ${buyerPhone} | ${buyerEmail}`, 44, curY + 46);
  doc.fillColor('#475569').fontSize(7.5).font('Helvetica').text(`Delivery Site: ${siteAddress}`, 44, curY + 58, { width: 240 });
  doc.fillColor('#0284c7').fontSize(7.5).font('Helvetica-Bold').text(`Delivery Site PIN: ${sitePincode}`, 44, curY + 82);

  // Right Card: WINNING SUPPLIER (L1)
  doc.roundedRect(304, curY, 255, 96, 4).fillAndStroke('#f0fdf4', '#86efac');
  doc.fillColor('#166534').fontSize(8.5).font('Helvetica-Bold').text('AWARDED L1 SUPPLIER (VENDOR / DISPATCH TO):', 312, curY + 8);
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text(supplierName, 312, curY + 22);
  doc.fillColor('#15803d').fontSize(7.5).font('Helvetica-Bold').text(`Verified GSTIN: ${supplierGst}`, 312, curY + 34);
  doc.fillColor('#475569').fontSize(7.5).font('Helvetica').text(`Registered Phone: ${supplierPhone}`, 312, curY + 46);
  doc.fillColor('#475569').fontSize(7.5).font('Helvetica').text(`Depot: ${supplierAddress}`, 312, curY + 58, { width: 240 });
  doc.fillColor('#166534').fontSize(7.5).font('Helvetica-Bold').text(`Auction Code Reference: ${supplierMaskedCode} (L1 Winner)`, 312, curY + 82);

  curY += 105;

  // 3. MATERIAL SPECIFICATIONS TABLE
  doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('MATERIAL DETAILS & COMMERCIAL RATE BREAKDOWN', 36, curY);
  curY += 12;

  // Table Header
  const colX = {
    sno: 36,
    desc: 60,
    hsn: 215,
    qty: 265,
    basic: 325,
    gst: 380,
    freightHamali: 435,
    landed: 495,
    total: 545
  };

  doc.rect(36, curY, 523, 18).fill('#0f172a');
  doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold');
  doc.text('#', colX.sno + 4, curY + 5);
  doc.text('ITEM DESCRIPTION & SPECIFICATION', colX.desc, curY + 5);
  doc.text('HSN/SAC', colX.hsn, curY + 5);
  doc.text('QTY / UOM', colX.qty, curY + 5);
  doc.text('BASIC RATE', colX.basic, curY + 5);
  doc.text('GST %', colX.gst, curY + 5);
  doc.text('FREIGHT/HAMALI', colX.freightHamali, curY + 5);
  doc.text('LANDED RATE', colX.landed, curY + 5);

  curY += 18;

  let grandTotalValue = 0;
  let totalBasicValue = 0;
  let totalGstValue = 0;

  const normalizedItems = Array.isArray(items) && items.length > 0 ? items : [
    {
      itemName: data.material_category || 'UltraTech PPC Cement (50kg Bag)',
      category: data.material_category || 'CEMENT',
      brand: data.brand_preference || 'UltraTech Cement',
      quantity: data.quantity || 200,
      unit: data.unit || 'BAGS',
      basicRate: awardedBid.basic_rate_per_unit || 250,
      gstPercent: awardedBid.gst_percent || 28,
      freight: awardedBid.freight_per_unit || 15,
      hamali: awardedBid.unloading_per_unit || 10,
      landedRate: awardedBid.total_landed_rate || 345,
      totalValue: awardedBid.total_order_value || 69000
    }
  ];

  normalizedItems.forEach((it, idx) => {
    const qty = Number(it.quantity || it.qty || 1);
    const basic = Number(it.basicRate || awardedBid.basic_rate_per_unit || 250);
    const gstRate = Number(it.gstPercent || awardedBid.gst_percent || 28);
    const gstAmt = Number(((basic * gstRate) / 100).toFixed(2));
    const freight = Number(it.freight || awardedBid.freight_per_unit || 15);
    const hamali = Number(it.hamali || awardedBid.unloading_per_unit || 10);
    const landed = Number(it.landedRate || (basic + gstAmt + freight + hamali).toFixed(2));
    const lineTotal = Number(it.totalValue || (landed * qty).toFixed(2));

    grandTotalValue += lineTotal;
    totalBasicValue += (basic * qty);
    totalGstValue += (gstAmt * qty);

    const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    doc.rect(36, curY, 523, 22).fillAndStroke(rowBg, '#e2e8f0');

    const descText = `${it.itemName || it.name || 'Construction Material'} (${it.brand || 'ISI Brand'})`;
    const hsn = it.hsnCode || getHsnCodeForMaterial(it.category || '', it.itemName || '');

    doc.fillColor('#1e293b').fontSize(7.5).font('Helvetica-Bold').text(String(idx + 1), colX.sno + 6, curY + 6);
    doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold').text(descText.slice(0, 36), colX.desc, curY + 4);
    doc.fillColor('#64748b').fontSize(6.5).font('Helvetica').text(`Spec: ${it.grade || 'Factory Fresh IS Certified'}`, colX.desc, curY + 12);
    doc.fillColor('#334155').fontSize(7.5).font('Helvetica').text(hsn, colX.hsn, curY + 6);
    doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold').text(`${qty} ${it.unit || 'BAGS'}`, colX.qty, curY + 6);
    doc.fillColor('#334155').fontSize(7.5).font('Helvetica').text(`₹${basic.toFixed(2)}`, colX.basic, curY + 6);
    doc.fillColor('#334155').fontSize(7.5).font('Helvetica').text(`${gstRate}% (₹${gstAmt.toFixed(1)})`, colX.gst, curY + 6);
    doc.fillColor('#334155').fontSize(7.5).font('Helvetica').text(`₹${freight + hamali}/u`, colX.freightHamali, curY + 6);
    doc.fillColor('#15803d').fontSize(8).font('Helvetica-Bold').text(`₹${landed.toFixed(2)}`, colX.landed, curY + 6);

    curY += 22;
  });

  // Table Total Row
  doc.rect(36, curY, 523, 24).fill('#f1f5f9');
  doc.rect(36, curY, 523, 24).stroke('#cbd5e1');
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('TOTAL CONTRACT ORDER VALUE (INCL. GST & FREIGHT):', 44, curY + 7);
  doc.fillColor('#15803d').fontSize(11).font('Helvetica-Bold').text(`₹${grandTotalValue.toLocaleString('en-IN')}`, 430, curY + 6, { align: 'right', width: 120 });

  curY += 32;

  // 4. EXPLICIT LOADING & UNLOADING TERMS BLOCK
  doc.rect(36, curY, 523, 56).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text('1. EXPLICIT LOADING & UNLOADING RESPONSIBILITIES', 44, curY + 6);
  doc.fillColor('#334155').fontSize(7).font('Helvetica');
  doc.text('• Loading Responsibility: Factory/depot mechanized loading onto transit trucks executed fully by Supplier at their sole cost.', 44, curY + 18);
  doc.text('• Unloading & Stacking Scope: Offloading & clean stacking at delivery site gate executed by Supplier\'s verified Hamali team / Hydra crane.', 44, curY + 28);
  doc.text('• Transit Risk & Gate Pass: Transit insurance covered under Supplier commercial policy until offloaded. Buyer facilitates gate clearance.', 44, curY + 38);
  doc.text('• Weighbridge & Tally: Mandatory computerized weighbridge tare/gross slip required prior to final site gate acceptance.', 44, curY + 48);

  curY += 62;

  // 5. COMMERCIAL PAYMENT TERMS & DELIVERY SCHEDULE BLOCK
  doc.rect(36, curY, 523, 54).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text('2. COMMERCIAL PAYMENT TERMS & DELIVERY SCHEDULE', 44, curY + 6);
  doc.fillColor('#334155').fontSize(7).font('Helvetica');
  doc.text(`• Payment Milestone: ${paymentTerms}. Payment released within 24 hours of physical gate inspection.`, 44, curY + 18);
  doc.text(`• Delivery Schedule: Strict site delivery by ${deliveryDeadline}. Time is strictly of the essence for this purchase contract.`, 44, curY + 28);
  doc.text(`• Quality Benchmark: ${qualityStandard}. Conforming to relevant Bureau of Indian Standards (BIS) specifications.`, 44, curY + 38);
  doc.text('• Inspection Protocols: Buyer reserves right to draw test samples for third-party NABL accredited laboratory batch certification.', 44, curY + 48);

  curY += 60;

  // 6. STANDARD TERMS & CONDITIONS BLOCK
  doc.rect(36, curY, 523, 56).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text('3. STANDARD LEGAL TERMS & CONDITIONS', 44, curY + 6);
  doc.fillColor('#334155').fontSize(7).font('Helvetica');
  doc.text('• Jurisdiction: This Purchase Order is governed by laws of India. Courts in Bengaluru, Karnataka have exclusive jurisdiction.', 44, curY + 18);
  doc.text('• Defect Liability: 12-month defect liability period against manufacturing defects, caking, or sub-standard strength. Replacement in 24 hrs.', 44, curY + 28);
  doc.text('• Liquidated Damages (LD): Delayed supply incurs LD @ 0.5% per calendar day of delay, capped at a maximum of 5.0% of PO value.', 44, curY + 38);
  doc.text('• Force Majeure: Neither party held liable for delays caused by natural acts, government bans, or declared industrial strikes.', 44, curY + 48);

  curY += 66;

  // 7. AUTHORIZED SIGNATORY & ACCEPTANCE BLOCK
  doc.rect(36, curY, 255, 62).stroke('#94a3b8');
  doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold').text('ISSUED & DIGITALLY VERIFIED BY:', 44, curY + 8);
  doc.fillColor('#15803d').fontSize(7).font('Helvetica-Bold').text('✔ BUILDMITRA AUTHORIZED PROCUREMENT DESK', 44, curY + 20);
  doc.fillColor('#64748b').fontSize(6.5).font('Helvetica').text('Digital Timestamp: ' + new Date().toISOString(), 44, curY + 30);
  doc.moveTo(44, curY + 48).lineTo(260, curY + 48).stroke('#cbd5e1');
  doc.fillColor('#475569').fontSize(7).font('Helvetica').text('Authorized Signatory (Procurement Officer / Buyer)', 44, curY + 52);

  doc.rect(304, curY, 255, 62).stroke('#94a3b8');
  doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold').text('CONFIRMED & ACCEPTED BY SUPPLIER:', 312, curY + 8);
  doc.fillColor('#15803d').fontSize(7).font('Helvetica-Bold').text(`✔ ${supplierName}`, 312, curY + 20);
  doc.fillColor('#64748b').fontSize(6.5).font('Helvetica').text(`GSTIN: ${supplierGst} | Contact: ${supplierPhone}`, 312, curY + 30);
  doc.moveTo(312, curY + 48).lineTo(528, curY + 48).stroke('#cbd5e1');
  doc.fillColor('#475569').fontSize(7).font('Helvetica').text('Supplier Acceptance Stamp & Authorized Signature', 312, curY + 52);

  // Bottom Notice
  doc.fillColor('#94a3b8').fontSize(6.5).font('Helvetica').text(
    'This is a legally binding electronic Purchase Order generated through BuildMitra Reverse Auction & RFQ Procurement Engine. Verified under IT Act 2000.',
    36,
    810,
    { align: 'center', width: 523 }
  );
}

module.exports = {
  buildProfessionalPoPdf,
  getHsnCodeForMaterial
};
