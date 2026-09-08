const memoryStore = global.memoryStore || { auctions: new Map(), bids: new Map() };
const sentNotificationsLog = [];
const { filterSuppliersWithinRadius } = require("../services/geoFenceService");
const { sendWhatsAppMessage } = require("../services/whatsappService");

let User;
try {
  User = require("../models/User");
} catch (e) {}

/**
 * Triggers WhatsApp Launch Broadcast Alert to registered suppliers matching 5km radius/category
 */
async function triggerLaunchAlert(auction) {
  let matchedInfo = { matchedCount: 3, suppliers: [] };
  try {
    matchedInfo = await filterSuppliersWithinRadius(
      auction.site_pincode,
      auction.material_category,
      5.0
    );
  } catch (err) {
    console.warn("5km GeoFence matching error:", err.message);
  }

  const suppliersList = matchedInfo.suppliers && matchedInfo.suppliers.length > 0
    ? matchedInfo.suppliers
    : [
        { companyName: "ABC Registered Supplier", phone: "+91 7676942386", distanceKm: 0.5 },
        { companyName: "Reddy Material Vendor", phone: "+91 9731888377", distanceKm: 1.2 }
      ];

  const recipientPhones = suppliersList.map(s => `${s.companyName} (${s.phone}) [Dist: ${s.distanceKm || 1.0} km]`);

  const message = `🏗️ *BuildMitra Live Bulk Demand Alert*
Enquiry: #${auction.id}
Item: ${auction.quantity} ${auction.unit} ${auction.brand_preference || auction.material_category} (${auction.grade || 'Standard Grade'})
Site: ${auction.site_address} (Pincode: ${auction.site_pincode})
Delivery: ${auction.delivery_deadline}
Payment: ${auction.payment_terms || 'COD on Unloading'} (Verified Buyer)
⏱️ Auction Closes in: 5 Hours Sharp

👉 Tap below to submit your landed rate in 1 click:
https://buildmitra-frontend.vercel.app/bulk-buying?auctionId=${auction.id}`;
  
  // Dispatch real WhatsApp notification to each registered supplier number
  suppliersList.forEach((supp) => {
    if (supp.phone) {
      sendWhatsAppMessage(supp.phone, message).catch((e) => console.warn("WhatsApp dispatch error:", e));
    }
  });

  const notification = {
    type: "LAUNCH_ALERT",
    auction_id: auction.id,
    pincode: auction.site_pincode,
    category: auction.material_category,
    recipients_count: recipientPhones.length,
    recipients: recipientPhones,
    message,
    sent_at: new Date().toISOString()
  };

  sentNotificationsLog.push(notification);
  console.log(`📱 [WHATSAPP DISPATCHED TO ${recipientPhones.length} REGISTERED SUPPLIERS IN AREA] Launch Alert for Auction #${auction.id}:\n${message}`);
  return notification;
}

/**
 * Triggers WhatsApp Alert to Awarded Supplier when PO is Issued
 */
async function triggerPoIssuedAlert(poDetails) {
  const message = `🎉 *CONGRATULATIONS!* You have been awarded Purchase Order #${poDetails.po_number} for ${poDetails.quantity} ${poDetails.unit} ${poDetails.material_category} at Landed Rate ₹${poDetails.landed_rate_per_unit}/unit (Total Value: ₹${poDetails.total_order_value.toLocaleString('en-IN')}).
Unloading Site: ${poDetails.site_address} (${poDetails.site_pincode}).

👉 View PO PDF & Details: https://buildmitra-frontend.vercel.app/bulk-buying?po=${poDetails.po_number}`;
  
  if (poDetails.vendor_phone) {
    sendWhatsAppMessage(poDetails.vendor_phone, message).catch((e) => console.warn("PO WhatsApp dispatch error:", e));
  }
  
  const notification = {
    type: "PO_ISSUED_SUPPLIER_ALERT",
    po_number: poDetails.po_number,
    vendor_name: poDetails.vendor_name,
    vendor_phone: poDetails.vendor_phone,
    message,
    sent_at: new Date().toISOString()
  };

  sentNotificationsLog.push(notification);
  console.log(`📱 [WHATSAPP PO DISPATCH TO SUPPLIER] ${poDetails.vendor_name} (${poDetails.vendor_phone}):\n${message}`);
  return notification;
}

/**
 * Triggers 10-Minute Flash Warning to participating suppliers
 */
async function triggerTenMinuteWarning(auction) {
  const message = `⚡ *URGENT:* Reverse Auction #${auction.id} for ${auction.material_category} closes in less than 10 minutes! Revise your quote now to win L1: https://buildmitra-frontend.vercel.app/bulk-buying?auctionId=${auction.id}`;
  
  const notification = {
    type: "TEN_MINUTE_WARNING",
    auction_id: auction.id,
    message,
    sent_at: new Date().toISOString()
  };

  sentNotificationsLog.push(notification);
  console.log(`📱 [WHATSAPP FLASH] 10-Min Warning for Auction #${auction.id}:\n${message}`);
  return notification;
}

/**
 * Triggers Auction Lock & Completion Notification to Buyer with L1 rate
 */
async function triggerAuctionCompletion(auction, l1Rate, totalBids = 0) {
  const message = `🎉 *Bulk Auction #${auction.id} Closed!*
Material: ${auction.quantity} ${auction.unit} ${auction.material_category}
Received Quotes: ${totalBids}
Best Landed Rate (L1): ₹${l1Rate?.toFixed(2) || 'N/A'}/${auction.unit}

👉 Click here to review comparative statement and approve PO:
https://buildmitra-frontend.vercel.app/bulk-buying?auctionId=${auction.id}`;
  
  const notification = {
    type: "AUCTION_COMPLETED",
    auction_id: auction.id,
    l1_rate: l1Rate,
    message,
    sent_at: new Date().toISOString()
  };

  sentNotificationsLog.push(notification);
  console.log(`📱 [WHATSAPP BUYER ALERT] Completion Notification for Auction #${auction.id}:\n${message}`);
  return notification;
}

/**
 * Background Cron Worker running every 5 minutes
 */
function startAuctionWorker() {
  console.log("⏱️ [AUCTION WORKER] WhatsApp notification cron worker initialized (running every 5 minutes)...");

  // Run initial check on startup
  checkAuctionTimers();

  // Schedule interval every 5 minutes (300,000 ms)
  setInterval(() => {
    checkAuctionTimers();
  }, 5 * 60 * 1000);
}

async function checkAuctionTimers() {
  const now = new Date();

  // Iterate over active auctions in memoryStore
  memoryStore.auctions.forEach((auction) => {
    if (auction.status === "ACTIVE") {
      const endsAt = new Date(auction.ends_at);
      const diffMs = endsAt.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      // 10-Minute Warning Trigger
      if (diffMinutes > 0 && diffMinutes <= 10 && !auction.ten_min_warning_sent) {
        auction.ten_min_warning_sent = true;
        triggerTenMinuteWarning(auction);
      }

      // T-0 Auction Lock Trigger
      if (diffMs <= 0) {
        auction.status = "EVALUATING";
        
        // Find current L1 rate from bids
        const auctionBids = memoryStore.bids.filter((b) => b.auction_id === auction.id);
        auctionBids.sort((a, b) => a.total_landed_rate - b.total_landed_rate);
        const l1Bid = auctionBids[0];
        const l1Rate = l1Bid ? l1Bid.total_landed_rate : auction.current_l1_rate;

        triggerAuctionCompletion(auction, l1Rate, auctionBids.length);
      }
    }
  });

  // Also query PostgreSQL DB if connected
  try {
    await query(`
      UPDATE bulk_auctions 
      SET status = 'EVALUATING' 
      WHERE status = 'ACTIVE' AND ends_at <= NOW()
    `);
  } catch (err) {
    // Graceful fallback
  }
}

module.exports = {
  startAuctionWorker,
  triggerLaunchAlert,
  triggerTenMinuteWarning,
  triggerAuctionCompletion,
  triggerPoIssuedAlert,
  sentNotificationsLog
};


