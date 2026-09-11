const mongoose = require('mongoose');

const RfqAuditLogSchema = new mongoose.Schema({
  rfqId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProcurementRfq', required: true, index: true },
  batchCode: { type: String, required: true, index: true },
  action: { type: String, required: true }, // e.g. RFQ_CREATED, QUOTE_SUBMITTED, AUCTION_STARTED, BID_PLACED, RFQ_AWARDED
  performedByRole: { type: String, enum: ['buyer', 'supplier', 'admin', 'system'], required: true },
  performedByUserCode: { type: String, default: '' },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('RfqAuditLog', RfqAuditLogSchema);
