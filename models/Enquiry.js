const mongoose = require("mongoose");

const EnquirySchema = new mongoose.Schema({
  enquiryCode: { type: String, unique: true },
  buyerUserCode: String,
  buyerName: { type: String, required: true, trim: true },
  buyerPhone: { type: String, required: true, trim: true },
  buyerEmail: String,

  providerUserCode: { type: String, required: true, trim: true },
  providerRole: String,
  providerName: String,
  providerPhone: String,

  itemType: String,
  itemName: String,
  quantity: String,
  unit: String,
  location: String,
  pincode: String,
  specification: String,
  message: String,

  status: { type: String, default: "Pending" },
  quotedAmount: Number,
  quoteMessage: String,
  quotedDate: String
}, { timestamps: true });

module.exports = mongoose.model("Enquiry", EnquirySchema);
