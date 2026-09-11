const mongoose = require('mongoose');

const SupplierRfqSchema = new mongoose.Schema({
  rfqId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProcurementRfq', required: true, index: true },
  batchCode: { type: String, required: true, index: true },
  enquiryCode: { type: String, required: true, unique: true, index: true }, // e.g. BM-ENQ-20260909-1001-S1
  
  supplierUserCode: { type: String, required: true, index: true },
  supplierName: { type: String, required: true },
  supplierPhone: { type: String, required: true },
  supplierEmail: { type: String, default: '' },
  
  quoteToken: { type: String, required: true, unique: true, index: true },
  
  status: {
    type: String,
    enum: ['SENT', 'VIEWED', 'QUOTED', 'DECLINED', 'AUCTION_BIDDING'],
    default: 'SENT',
    index: true
  },

  whatsappStatus: {
    type: String,
    enum: ['SHARE_READY', 'SENT', 'DELIVERED', 'FAILED'],
    default: 'SHARE_READY',
    index: true
  },

  whatsappDeliveryTime: { type: Date, default: null },
  lastViewedAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

SupplierRfqSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  if (typeof next === 'function') {
    next();
  }
});

module.exports = mongoose.model('SupplierRfq', SupplierRfqSchema);
