const mongoose = require("mongoose");

const EnquirySchema = new mongoose.Schema(
  {
    enquiryCode: { type: String, unique: true, index: true },
    batchCode: { type: String, default: "", trim: true, index: true },
    cartItems: { type: Array, default: [] },

    buyerUserCode: { type: String, default: "", trim: true, index: true },
    buyerName: { type: String, required: true, trim: true },
    buyerPhone: { type: String, required: true, trim: true },
    buyerEmail: { type: String, default: "", trim: true },

    // Original uploader/provider attached to the listing/property.
    providerUserCode: { type: String, required: true, trim: true, index: true },
    providerRole: { type: String, default: "", trim: true },
    providerName: { type: String, default: "", trim: true },
    providerPhone: { type: String, default: "", trim: true },

    enquiryCategory: {
      type: String,
      enum: ["marketplace", "realestate", "general"],
      default: "marketplace",
      index: true,
    },

    propertyCode: { type: String, default: "", trim: true, index: true },
    listingCode: { type: String, default: "", trim: true, index: true },

    itemType: { type: String, default: "", trim: true },
    itemName: { type: String, default: "", trim: true },
    quantity: { type: String, default: "", trim: true },
    unit: { type: String, default: "", trim: true },
    location: { type: String, default: "", trim: true },
    pincode: { type: String, default: "", trim: true },
    specification: { type: String, default: "", trim: true },
    message: { type: String, default: "", trim: true },

    preferredVisitDate: { type: String, default: "", trim: true },
    preferredVisitTime: { type: String, default: "", trim: true },
    visitStatus: {
      type: String,
      enum: ["Not Requested", "Requested", "Scheduled", "Completed", "Cancelled"],
      default: "Not Requested",
    },

    // Every enquiry enters the Admin queue first.
    adminApprovalStatus: {
      type: String,
      enum: ["pending_admin", "approved", "assigned", "rejected", "hold"],
      default: "pending_admin",
      index: true,
    },
    adminRemarks: { type: String, default: "", trim: true },
    reviewedBy: { type: String, default: "", trim: true },
    reviewedAt: Date,

    // Final provider selected by Admin. It may be the original uploader.
    assignedProviderUserCode: { type: String, default: "", trim: true, index: true },
    assignedProviderRole: { type: String, default: "", trim: true },
    assignedProviderName: { type: String, default: "", trim: true },
    assignedProviderPhone: { type: String, default: "", trim: true },
    assignedBy: { type: String, default: "", trim: true },
    assignedAt: Date,

    contactReleased: { type: Boolean, default: false, index: true },
    contactReleasedAt: Date,

    adminPhone: { type: String, default: "", trim: true },
    contactRoute: {
      type: String,
      enum: ["admin", "provider", "forwarded-user"],
      default: "admin",
    },

    // Kept for compatibility with the existing UI while it is migrated.
    forwardedToUserCode: { type: String, default: "", trim: true },
    forwardedToName: { type: String, default: "", trim: true },
    forwardedToPhone: { type: String, default: "", trim: true },
    forwardedBy: { type: String, default: "", trim: true },
    forwardedAt: Date,

    status: {
      type: String,
      enum: [
        "Pending Admin",
        "Pending",
        "On Hold",
        "Approved",
        "Assigned",
        "Viewed",
        "Quote Submitted",
        "Quote Received",
        "Accepted",
        "Rejected",
        "Contacted",
        "Visit Scheduled",
        "Quoted",
        "Closed"
      ],
      default: "Pending Admin",
      index: true,
    },

    quotedAmount: { type: Number, default: 0 },
    quoteMessage: { type: String, default: "" },
    quoteValidityDate: { type: String, default: "" },
    paymentTerms: { type: String, default: "" },
    gstIncluded: { type: Boolean, default: false },
    transportCharges: { type: Number, default: 0 },
    quotedDate: { type: String, default: "" },
  },
  { timestamps: true }
);

EnquirySchema.index({ adminApprovalStatus: 1, createdAt: -1 });
EnquirySchema.index({ assignedProviderUserCode: 1, contactReleased: 1, createdAt: -1 });
EnquirySchema.index({ enquiryCategory: 1, propertyCode: 1, providerUserCode: 1, createdAt: -1 });

module.exports = mongoose.model("Enquiry", EnquirySchema);
