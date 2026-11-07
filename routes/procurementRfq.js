const express = require('express');
const router = express.Router();
const controller = require('../controllers/procurementRfqController');

// 1. Create and Launch RFQ Batch
router.post('/create', controller.createRfq);

// 2. Search Eligible Suppliers
router.get('/eligible-suppliers', controller.getEligibleSuppliers);

// 2b. Master Materials Catalog
router.get('/master-catalog', controller.getMasterCatalog);

// 3. Buyer RFQ List
router.get('/buyer-list', controller.getBuyerRfqs);

// 4. Supplier Assigned RFQs
router.get('/supplier-list', controller.getSupplierRfqs);

// 5. Public Quote Token Link Details
router.get('/token/:token', controller.getRfqByToken);

// 6. Submit Supplier Quote Revision
router.post('/submit-quote', controller.submitSupplierQuote);

// 7. 1-Click WhatsApp Quick Bid Submission
router.post('/whatsapp-bid', controller.submitWhatsappQuickBid);

// 8. BI Tabulation & Quote Comparison Matrix
router.get('/tabulation/:batchCode', controller.getTabulationMatrix);

// 9. Launch Reverse Auction
router.post('/start-auction', controller.startReverseAuction);

// 10. Submit Live Reverse Auction Bid
router.post('/submit-bid', controller.submitAuctionBid);

// 11. Download Automated PO PDF
router.get('/download-po/:batchCode', controller.generatePoPdf);

module.exports = router;
