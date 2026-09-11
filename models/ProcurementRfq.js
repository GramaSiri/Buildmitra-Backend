const mongoose = require('mongoose');

const ProcurementRfqSchema = new mongoose.Schema({
  batchCode: { type: String, required: true, unique: true, index: true }, // e.g. BM-RFQ-20260909-1001
  title: { type: String, default: 'Bulk Procurement Request' },
  buyerUserCode: { type: String, required: true, index: true },
  buyerName: { type: String, required: true },
  buyerPhone: { type: String, required: true },
  buyerEmail: { type: String, default: '' },
  
  items: [{
    itemCode: { type: String, default: '' },
    itemName: { type: String, required: true },
    category: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    targetRate: { type: Number, default: 0 },
    estTotal: { type: Number, default: 0 },
    remarks: { type: String, default: '' }
  }],

  deliverySite: {
    address: { type: String, required: true },
    city: { type: String, default: '' },
    pincode: { type: String, required: true, index: true },
    requiredDate: { type: String, default: '' },
    paymentTerms: { type: String, default: 'COD on Unloading' },
    notes: { type: String, default: '' }
  },

  grandTotalEstValue: { type: Number, default: 0 },

  auctionSettings: {
    isAuctionActive: { type: Boolean, default: false },
    durationHours: { type: Number, default: 5 },
    minDecrement: { type: Number, default: 10 }, // Min ₹ reduction per bid
    startTime: { type: Date, default: null },
    endTime: { type: Date, default: null },
    currentL1Rate: { type: Number, default: 0 },
    currentL1SupplierCode: { type: String, default: '' }
  },

  status: {
    type: String,
    enum: ['DRAFT', 'BROADCASTED', 'QUOTES_RECEIVED', 'AUCTION_ACTIVE', 'AUCTION_ENDED', 'AWARDED', 'CANCELLED'],
    default: 'BROADCASTED',
    index: true
  },

  assignedSupplierCount: { type: Number, default: 0 },
  quotesCount: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

ProcurementRfqSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  if (typeof next === 'function') {
    next();
  }
});

module.exports = mongoose.model('ProcurementRfq', ProcurementRfqSchema);
