const mongoose = require("mongoose");

const QuoteSchema = new mongoose.Schema(
  {
    quoteCode: { type: String, unique: true, sparse: true, index: true },
    enquiryCode: { type: String, required: true, index: true },
    batchCode: { type: String, default: "", trim: true },

    buyerUserCode: { type: String, default: "", trim: true, index: true },
    buyerName: { type: String, default: "", trim: true },
    buyerPhone: { type: String, default: "", trim: true },

    providerUserCode: { type: String, required: true, index: true },
    providerName: { type: String, default: "", trim: true },
    providerPhone: { type: String, default: "", trim: true },
    providerRole: { type: String, default: "", trim: true },

    items: { type: Array, default: [] },
    rate: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    unit: { type: String, default: "", trim: true },

    subtotal: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    transportCharges: { type: Number, default: 0 },
    loadingCharges: { type: Number, default: 0 },
    unloadingCharges: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },

    totalAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    deliveryTime: String,
    terms: String,
    remarks: String,

    attachmentUrl: String,
    attachmentName: String,
    attachmentSize: String,
    attachmentType: String,

    status: {
      type: String,
      default: "sent",
      index: true
    },

    whatsappMessage: String
  },
  { timestamps: true }
);

module.exports = mongoose.models.Quote || mongoose.model("Quote", QuoteSchema);
