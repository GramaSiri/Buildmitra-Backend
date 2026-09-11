const mongoose = require('mongoose');

const WhatsappLogSchema = new mongoose.Schema({
  rfqId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProcurementRfq', required: true, index: true },
  supplierUserCode: { type: String, required: true, index: true },
  supplierPhone: { type: String, required: true },
  messageType: { type: String, enum: ['RFQ_BROADCAST', 'AUCTION_WARNING', 'AUCTION_WINNER', 'PO_ISSUED'], default: 'RFQ_BROADCAST' },
  messageContent: { type: String, default: '' },
  deliveryStatus: { type: String, enum: ['SHARE_READY', 'SENT', 'DELIVERED', 'FAILED'], default: 'SHARE_READY' },
  externalRef: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('WhatsappLog', WhatsappLogSchema);
