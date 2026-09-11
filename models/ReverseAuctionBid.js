const mongoose = require('mongoose');

const ReverseAuctionBidSchema = new mongoose.Schema({
  rfqId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProcurementRfq', required: true, index: true },
  batchCode: { type: String, required: true, index: true },
  supplierUserCode: { type: String, required: true, index: true },
  supplierName: { type: String, required: true },

  roundNumber: { type: Number, default: 1 },
  bidAmount: { type: Number, required: true },
  previousBidAmount: { type: Number, default: 0 },
  decrementAmount: { type: Number, default: 0 },

  maskedRivalName: { type: String, default: 'Supplier' },

  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('ReverseAuctionBid', ReverseAuctionBidSchema);
