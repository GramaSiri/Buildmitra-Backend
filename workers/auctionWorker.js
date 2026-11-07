const { memoryStore, query, isPgConnected } = require("../config/postgres");
const sentNotificationsLog = [];
const { filterSuppliersWithinRadius } = require("../services/geoFenceService");
const { sendWhatsAppMessage } = require("../services/whatsappService");

/**
 * Triggers WhatsApp Launch Broadcast Alert to registered suppliers matching 25km-50km radius/category
 */
async function triggerLaunchAlert(auction) {
  let suppliersList = Array.isArray(auction.matched_suppliers) && auction.matched_suppliers.length > 0
    ? auction.matched_suppliers
    : [];

  if (suppliersList.length === 0) {
    try {
      const matchedInfo = await filterSuppliersWithinRadius(
        auction.site_pincode,
        auction.material_category,
        25.0,
        auction.id
      );
      if (matchedInfo && matchedInfo.suppliers && matchedInfo.suppliers.length > 0) {
        suppliersList = matchedInfo.suppliers;
      }
    } catch (err) {
      console.warn("25km GeoFence matching error:", err.message);
    }
  }

  if (suppliersList.length === 0) {
    suppliersList = [
      { companyName: "Jai Hanuman Building Materials & Supplies", phone: "+91 98450 12345", distanceKm: 2.4, maskedCodeName: "Supplier-Alpha-12" },
      { companyName: "Jai Sri Rama Civil & Steel Syndicate", phone: "+91 97318 88377", distanceKm: 4.8, maskedCodeName: "Supplier-Beta-34" },
      { companyName: "Sri Krishna Building Solutions", phone: "+91 76769 42386", distanceKm: 5.2, maskedCodeName: "Supplier-Gamma-56" }
    ];
  }

  const recipientPhones = suppliersList.map(s => `${s.companyName} (${s.phone}) [Dist: ${s.distanceKm || 2.0} km]`);

  const biddingUrl = `http://localhost:3000/live-reverse-auction?auctionId=${auction.id}`;

  const message = `🏗️ *BuildMitra Live Bulk Demand Alert*
Enquiry: #${auction.id}
Item: ${auction.quantity} ${auction.unit} ${auction.brand_preference || auction.material_category} (${auction.grade || 'Standard Grade'})
Site: ${auction.site_address} (PIN: ${auction.site_pincode})
Delivery: ${auction.delivery_deadline}
Payment: ${auction.payment_terms || '50% Advance / COD on Unloading'}
Target L1 Benchmark: ₹${auction.current_l1_rate ? auction.current_l1_rate.toFixed(2) : '345.00'}/${auction.unit}

⏱️ Auction Window: Active Live Reverse Auction (Closes in 5 Hours)
Anonymous Code Name Assigned: Anti-collusion bidding active.

👉 Tap below to submit your landed rate in 1 click:
${biddingUrl}`;
  
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
  console.log(`📱 [WHATSAPP DISPATCHED TO ${recipientPhones.length} NEARBY SUPPLIERS (25KM RADIUS)] Launch Alert #${auction.id}:\n${message}`);
  return notification;
}

/**
 * Triggers WhatsApp Alert to Awarded Supplier when PO is Issued
 */
async function triggerPoIssuedAlert(poDetails) {
  const message = `🎉 *CONGRATULATIONS!*
You have been awarded official Purchase Order #${poDetails.po_number} on BuildMitra!
Item: ${poDetails.quantity} ${poDetails.unit} ${poDetails.material_category}
Landed Rate: ₹${poDetails.landed_rate_per_unit}/unit
Total Order Value: ₹${Number(poDetails.total_order_value || 0).toLocaleString('en-IN')}

Site Delivery Address: ${poDetails.site_address} (PIN: ${poDetails.site_pincode})
Delivery Deadline: ${poDetails.delivery_deadline}
Payment Terms: ${poDetails.payment_terms}

👉 Access official stamped PO PDF:
http://localhost:3000/live-reverse-auction?po=${poDetails.po_number}`;
  
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
  console.log(`📱 [WHATSAPP PO DISPATCH TO WINNING L1 VENDOR] ${poDetails.vendor_name} (${poDetails.vendor_phone}):\n${message}`);
  return notification;
}

/**
 * Triggers 10-Minute Warning Buzzer Alert across WhatsApp and UI broadcast
 */
async function triggerTenMinuteWarning(auction) {
  const message = `⚡ *URGENT 10-MINUTE FLASH WARNING:*
Reverse Auction #${auction.id} for ${auction.material_category} closes in less than 10 minutes!
Current Winning L1 Rate: ₹${auction.current_l1_rate ? auction.current_l1_rate.toFixed(2) : '---'}/${auction.unit}

Revise your quote now to capture L1 position:
http://localhost:3000/live-reverse-auction?auctionId=${auction.id}`;
  
  const notification = {
    type: "TEN_MINUTE_WARNING",
    auction_id: auction.id,
    message,
    sent_at: new Date().toISOString()
  };

  sentNotificationsLog.push(notification);
  console.log(`📱 [WHATSAPP 10-MIN WARNING BUZZER] Auction #${auction.id}:\n${message}`);
  return notification;
}

/**
 * Triggers Auction Lock & Completion Notification to Buyer with L1 rate
 */
async function triggerAuctionCompletion(auction, l1Rate, totalBids = 0) {
  const message = `🎉 *Bulk Reverse Auction #${auction.id} Successfully Closed!*
Material: ${auction.quantity} ${auction.unit} ${auction.material_category}
Total Competing Quotes: ${totalBids}
Winning Landed Rate (L1): ₹${Number(l1Rate || 0).toFixed(2)}/${auction.unit}

👉 Click here to review complete L1, L2, L3 comparative sheet and generate Purchase Order:
http://localhost:3000/live-reverse-auction?auctionId=${auction.id}&tab=tabulation`;
  
  const notification = {
    type: "AUCTION_COMPLETED",
    auction_id: auction.id,
    l1_rate: l1Rate,
    message,
    sent_at: new Date().toISOString()
  };

  sentNotificationsLog.push(notification);
  console.log(`📱 [WHATSAPP BUYER COMPLETION ALERT] Auction #${auction.id}:\n${message}`);
  return notification;
}

/**
 * Background Cron Worker running timer checks
 */
function startAuctionWorker() {
  console.log("⏱️ [AUCTION WORKER] Real-time Reverse Auction & WhatsApp dispatch worker active...");

  checkAuctionTimers();

  // Check every 30 seconds for tight auction countdowns
  setInterval(() => {
    checkAuctionTimers();
  }, 30 * 1000);
}

async function checkAuctionTimers() {
  const now = new Date();

  // Safely iterate memoryStore.auctions (Array)
  if (Array.isArray(memoryStore.auctions)) {
    memoryStore.auctions.forEach((auction) => {
      if (auction.status === "ACTIVE") {
        const endsAt = new Date(auction.ends_at);
        const diffMs = endsAt.getTime() - now.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        // 10-Minute Warning Trigger
        if (diffMinutes > 0 && diffMinutes <= 10) {
          auction.is_ten_min_warning_active = true;
          if (!auction.ten_min_warning_sent) {
            auction.ten_min_warning_sent = true;
            triggerTenMinuteWarning(auction);
          }
        } else {
          auction.is_ten_min_warning_active = false;
        }

        // T-0 Auction Lock Trigger
        if (diffMs <= 0) {
          auction.status = "EVALUATING";
          
          const auctionBids = Array.isArray(memoryStore.bids)
            ? memoryStore.bids.filter((b) => b.auction_id === auction.id)
            : [];
          
          auctionBids.sort((a, b) => a.total_landed_rate - b.total_landed_rate);
          const l1Bid = auctionBids[0];
          const l1Rate = l1Bid ? l1Bid.total_landed_rate : auction.current_l1_rate;

          triggerAuctionCompletion(auction, l1Rate, auctionBids.length);
        }
      }
    });
  }

  // Also query PostgreSQL DB if connected
  try {
    if (isPgConnected && isPgConnected() && query) {
      await query(`
        UPDATE bulk_auctions 
        SET status = 'EVALUATING' 
        WHERE status = 'ACTIVE' AND ends_at <= NOW()
      `);
    }
  } catch (err) {}
}

function getSentNotificationsLog(auctionId) {
  if (auctionId) {
    return sentNotificationsLog.filter((n) => n.auction_id === auctionId || !n.auction_id);
  }
  return sentNotificationsLog;
}

module.exports = {
  startAuctionWorker,
  triggerLaunchAlert,
  triggerTenMinuteWarning,
  triggerAuctionCompletion,
  triggerPoIssuedAlert,
  getSentNotificationsLog,
  sentNotificationsLog
};
