const mongoose = require("mongoose");

const QuoteSchema = new mongoose.Schema({
  quoteCode: { type: String, unique: true, sparse: true },
  enquiryCode: { type: String, required: true },

  providerUserCode: { type: String, required: true },
  providerName: String,
  providerPhone: String,

  rate: String,
  quantity: String,
  totalAmount: String,
  deliveryTime: String,
  terms: String,
  remarks: String,

  status: {
    type: String,
    enum: ["sent", "accepted", "rejected"],
    default: "sent"
  },

  whatsappMessage: String,

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Quote", QuoteSchema);
