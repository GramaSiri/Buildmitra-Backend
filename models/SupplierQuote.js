const mongoose = require('mongoose');

const SupplierQuoteSchema = new mongoose.Schema({
  rfqId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProcurementRfq', required: true, index: true },
  supplierRfqId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupplierRfq', required: true, index: true },
  batchCode: { type: String, required: true, index: true },
  enquiryCode: { type: String, required: true, index: true },
  
  supplierUserCode: { type: String, required: true, index: true },
  supplierName: { type: String, required: true },
  supplierPhone: { type: String, required: true },

  version: { type: Number, default: 1 }, // V1, V2, V3
  isLatest: { type: Boolean, default: true, index: true },

  lineItems: [{
    itemCode: { type: String, default: '' },
    itemName: { type: String, required: true },
    category: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    rate: { type: Number, required: true }, // Per unit rate offered
    taxPercent: { type: Number, default: 18 },
    amount: { type: Number, required: true }, // rate * qty
    remarks: { type: String, default: '' }
  }],

  subTotal: { type: Number, required: true },
  freightCharge: { type: Number, default: 0 },
  gstTotal: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true },

  deliveryTimelineDays: { type: Number, default: 1 },
  validityDays: { type: Number, default: 7 },
  paymentTermsAccepted: { type: String, default: 'COD' },
  supplierNotes: { type: String, default: '' },

  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('SupplierQuote', SupplierQuoteSchema);
