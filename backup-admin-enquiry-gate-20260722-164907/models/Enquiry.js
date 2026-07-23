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

  enquiryCategory: {
    type: String,
    enum: ["marketplace", "realestate", "general"],
    default: "marketplace",
    index: true,
  },

  propertyCode: {
    type: String,
    default: "",
    trim: true,
    index: true,
  },

  itemType: String,
  itemName: String,
  quantity: String,
  unit: String,
  location: String,
  pincode: String,
  specification: String,
  message: String,

  preferredVisitDate: String,
  preferredVisitTime: String,
  visitStatus: {
    type: String,
    enum: ["Not Requested", "Requested", "Scheduled", "Completed", "Cancelled"],
    default: "Not Requested",
  },

  adminPhone: {
    type: String,
    default: "",
    trim: true,
  },

  contactRoute: {
    type: String,
    enum: ["provider", "admin", "forwarded-user"],
    default: "provider",
  },

  forwardedToUserCode: {
    type: String,
    default: "",
    trim: true,
  },
  forwardedToName: {
    type: String,
    default: "",
    trim: true,
  },
  forwardedToPhone: {
    type: String,
    default: "",
    trim: true,
  },
  forwardedBy: {
    type: String,
    default: "",
    trim: true,
  },
  forwardedAt: Date,

  status: { type: String, default: "Pending" },

quotedAmount: {
  type: Number,
  default: 0,
},

quoteMessage: {
  type: String,
  default: "",
},

quoteValidityDate: {
  type: String,
  default: "",
},

paymentTerms: {
  type: String,
  default: "",
},

gstIncluded: {
  type: Boolean,
  default: false,
},

transportCharges: {
  type: Number,
  default: 0,
},

quotedDate: {
  type: String,
  default: "",
}
}, { timestamps: true });

EnquirySchema.index({
  enquiryCategory: 1,
  propertyCode: 1,
  providerUserCode: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Enquiry", EnquirySchema);
